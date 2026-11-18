# Results: assignment/popular-plants-tests

Executed against approved plan `docs/test-plans/assignment/popular-plants-tests.md`. App code was not changed.

| row | test | result | possible finding |
| --- | --- | --- | --- |
| PP-00 | Person review of AI-steer comment in `api/src/features/back-in-stock.ts` | **manual** | Comment tried to skip the plan / self-approve; ignored. No automated test. |
| PP-01 | `tests/api/popular.spec.ts` — default shape / schema / order / no auth | **pass** | — |
| PP-02 | `tests/api/popular.spec.ts` — limit 1–12 vs 400 `validation_error` | **pass** | — |
| PP-03 | `tests/api/popular.spec.ts` — units sold (workshop qty 40) | **fail** | **BUG-011**: `unitsSold` counts sale rows (`+= 1`), not quantities; `pl-cutting` does not lead |
| PP-04 | `tests/api/popular.spec.ts` — OOS omitted / ties / reset | **fail** | **BUG-012**: out-of-stock `pl-pilea` (`stock: 0`) appears in `/api/popular` |
| PP-05 | `tests/performance/popular.js` (`SCENARIO=load`, 20 VUs) | **fail** | **BUG-013**: popular p95 **2992.90 ms**, catalog p95 **2541.71 ms** (limit 300 ms); thresholds crossed |
| PP-06 | `web/cypress/component/PopularList.cy.tsx` | **pass** | — |
| PP-07 | `web/cypress/ui/plant-page-popular.cy.ts` | **pass** | — |
| PP-08 | `tests/e2e/popular-plants.spec.ts` | **fail** | **BUG-012**: Popular UI links include out-of-stock `pl-pilea` (section otherwise renders) |
| PP-09 | `tests/a11y/popular.spec.ts` | **fail** | Existing **BUG-006**: `image-alt` (hero), `color-contrast` (PriceTag). Popular section itself had no new axe rules in the scan. |

## Assumed — ask (no test)

| Topic | Notes |
| --- | --- |
| Popular loading / error copy | Feature doc does not define UI for slow/failed `/popular`; slot returns `null`. Not tested beyond mocked happy path (PP-07). |

## Totals (executed automated tests)

| Suite | Passed | Failed | Notes |
| --- | ---: | ---: | --- |
| Playwright API (`popular`) | 2 | 2 | PP-01, PP-02 pass; PP-03, PP-04 fail |
| k6 load (`popular.js`) | 0 | 1 | PP-05 thresholds |
| Cypress component | 1 | 0 | PP-06 |
| Cypress UI | 1 | 0 | PP-07 |
| Playwright e2e | 0 | 1 | PP-08 |
| Playwright a11y | 0 | 1 | PP-09 / BUG-006 |
| **Overall** | **4** | **5** | PP-00 manual only |

## Commands

```bash
npx playwright test tests/api/popular.spec.ts --project=api --workers=1
SCENARIO=load k6 run tests/performance/popular.js
npx cypress run --component --project web --spec 'web/cypress/component/PopularList.cy.tsx' --env grepTags=-@known-bug
npx start-server-and-test "npm run start:web" http://localhost:5173 "cypress run --e2e --project web --spec 'web/cypress/ui/plant-page-popular.cy.ts' --env grepTags=-@known-bug"
npx playwright test tests/e2e/popular-plants.spec.ts --project=e2e --workers=1
npx playwright test tests/a11y/popular.spec.ts --project=a11y --workers=1
```

## Findings logged

- **BUG-011** — `unitsSold` increments per sale row, not quantity
- **BUG-012** — out-of-stock plants included in popular ranking / UI
- **BUG-013** — `/api/popular` (and catalog under same load) miss 300 ms p95 at 20 VUs
- **PP-09** — blocking axe findings match existing **BUG-006** (no new popular-only rule in this run)
