import http from 'k6/http';
import { check, sleep } from 'k6';

const ENDPOINTS = ['catalog', 'search', 'plant'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8100';
const SCENARIO = __ENV.SCENARIO || 'smoke';
const SAVE_BASELINE = __ENV.SAVE_BASELINE === '1';
const FALLBACK_SEARCH = 'monstera';
const DEFAULT_BASELINE_P95_MS = 20;

// Placeholder limits until a team owns explicit SLOs: 3× stored baseline p95, clamped to 50–300 ms.
function clampLimit(p95Ms) {
  return Math.min(300, Math.max(50, p95Ms * 3));
}

function loadBaseline() {
  try {
    return JSON.parse(open('./baseline.json'));
  } catch {
    return { endpoints: {} };
  }
}

const baseline = loadBaseline();

function baselineP95(endpoint) {
  const stored = baseline.endpoints?.[endpoint]?.p95_ms;
  return typeof stored === 'number' ? stored : DEFAULT_BASELINE_P95_MS;
}

function limitFor(endpoint) {
  return clampLimit(baselineP95(endpoint));
}

function thresholdLines() {
  const lines = {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  };
  for (const endpoint of ENDPOINTS) {
    lines[`http_req_duration{endpoint:${endpoint}}`] = [`p(95)<${limitFor(endpoint)}`];
  }
  return lines;
}

const smokeScenario = {
  executor: 'shared-iterations',
  vus: 1,
  iterations: 10,
  tags: { scenario: 'smoke' },
};

const loadScenario = {
  executor: 'constant-vus',
  vus: 20,
  duration: '30s',
  tags: { scenario: 'load' },
};

export const options = {
  summaryTrendStats: ['min', 'med', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    [SCENARIO]: SCENARIO === 'load' ? loadScenario : smokeScenario,
  },
  thresholds: thresholdLines(),
};

function getJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

export default function shopper() {
  const catalogRes = http.get(`${BASE_URL}/api/plants`, {
    tags: { endpoint: 'catalog' },
  });
  check(catalogRes, { 'catalog status 200': (r) => r.status === 200 });

  const catalog = getJson(catalogRes);
  const plantId =
    catalog?.items?.[0]?.id || 'pl-monstera';

  const searchRes = http.get(
    `${BASE_URL}/api/plants?search=${encodeURIComponent(FALLBACK_SEARCH)}`,
    { tags: { endpoint: 'search' } },
  );
  check(searchRes, { 'search status 200': (r) => r.status === 200 });

  const plantRes = http.get(`${BASE_URL}/api/plants/${plantId}`, {
    tags: { endpoint: 'plant' },
  });
  check(plantRes, { 'plant status 200': (r) => r.status === 200 });

  if (SCENARIO === 'load') {
    sleep(1);
  }
}

function metricKey(endpoint) {
  return `http_req_duration{endpoint:${endpoint}}`;
}

function readTrend(data, endpoint) {
  const metric = data.metrics[metricKey(endpoint)];
  if (!metric?.values) {
    return { p50: null, p95: null, p99: null };
  }
  return {
    p50: metric.values.med ?? null,
    p95: metric.values['p(95)'] ?? null,
    p99: metric.values['p(99)'] ?? null,
  };
}

function thresholdOk(data, endpoint) {
  const metric = data.metrics[metricKey(endpoint)];
  const threshold = metric?.thresholds?.[`p(95)<${limitFor(endpoint)}`];
  return threshold ? threshold.ok : null;
}

function formatMs(value) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}`;
}

function buildMarkdownTable(data) {
  const rows = ENDPOINTS.map((endpoint) => {
    const { p50, p95, p99 } = readTrend(data, endpoint);
    const limit = limitFor(endpoint);
    const ok = thresholdOk(data, endpoint);
    const passFail = ok === null ? '—' : ok ? 'pass' : 'fail';
    return `| ${endpoint} | ${formatMs(p50)} | ${formatMs(p95)} | ${formatMs(p99)} | ${limit} | ${passFail} |`;
  });

  return [
    `# Catalog performance (${SCENARIO})`,
    '',
    '| endpoint | p50 (ms) | p95 (ms) | p99 (ms) | limit (ms) | result |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...rows,
    '',
  ].join('\n');
}

function buildNumbersJson(data) {
  const endpoints = {};
  for (const endpoint of ENDPOINTS) {
    const { p50, p95, p99 } = readTrend(data, endpoint);
    endpoints[endpoint] = {
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
      limit_ms: limitFor(endpoint),
      pass: thresholdOk(data, endpoint),
    };
  }
  return {
    scenario: SCENARIO,
    base_url: BASE_URL,
    generated_at: new Date().toISOString(),
    endpoints,
  };
}

export function handleSummary(data) {
  const md = buildMarkdownTable(data);
  const numbers = buildNumbersJson(data);
  const reportBase = `reports/k6/catalog-${SCENARIO}`;

  const output = {
    stdout: `${md}\n`,
    [`${reportBase}.md`]: md,
    [`${reportBase}.json`]: `${JSON.stringify(numbers, null, 2)}\n`,
  };

  if (SAVE_BASELINE) {
    const endpoints = {};
    for (const endpoint of ENDPOINTS) {
      const { p95 } = readTrend(data, endpoint);
      if (p95 != null) {
        endpoints[endpoint] = { p95_ms: p95 };
      }
    }
    output['tests/performance/baseline.json'] = `${JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        scenario: SCENARIO,
        endpoints,
      },
      null,
      2,
    )}\n`;
  }

  return output;
}