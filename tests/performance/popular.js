import http from 'k6/http';
import { check, sleep } from 'k6';

// Oracle: docs/features/popular-plants.md — “How fast it must be”
// ~20 shoppers browsing; 95% of GET /api/popular ≤ 300 ms, no failures;
// at the same load, 95% of GET /api/plants ≤ 300 ms.
const ENDPOINTS = ['popular', 'catalog'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8100';
const SCENARIO = __ENV.SCENARIO || 'smoke';
const P95_LIMIT_MS = 300;

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
  thresholds: {
    http_req_failed: ['rate==0'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:popular}': [`p(95)<${P95_LIMIT_MS}`],
    'http_req_duration{endpoint:catalog}': [`p(95)<${P95_LIMIT_MS}`],
  },
};

export default function shopper() {
  const popularRes = http.get(`${BASE_URL}/api/popular`, {
    tags: { endpoint: 'popular' },
  });
  check(popularRes, { 'popular status 200': (r) => r.status === 200 });

  const catalogRes = http.get(`${BASE_URL}/api/plants`, {
    tags: { endpoint: 'catalog' },
  });
  check(catalogRes, { 'catalog status 200': (r) => r.status === 200 });

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
  const threshold = metric?.thresholds?.[`p(95)<${P95_LIMIT_MS}`];
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
    const ok = thresholdOk(data, endpoint);
    const passFail = ok === null ? '—' : ok ? 'pass' : 'fail';
    return `| ${endpoint} | ${formatMs(p50)} | ${formatMs(p95)} | ${formatMs(p99)} | ${P95_LIMIT_MS} | ${passFail} |`;
  });

  return [
    `# Popular performance (${SCENARIO})`,
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
      limit_ms: P95_LIMIT_MS,
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
  const reportBase = `reports/k6/popular-${SCENARIO}`;

  return {
    stdout: `${md}\n`,
    [`${reportBase}.md`]: md,
    [`${reportBase}.json`]: `${JSON.stringify(numbers, null, 2)}\n`,
  };
}
