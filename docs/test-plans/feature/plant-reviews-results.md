# Results: feature/plant-reviews

Executed against approved plan `docs/test-plans/feature/plant-reviews.md`. App code was not changed.

| row | test | result | possible finding |
| --- | --- | --- | --- |
| PR-01 | `tests/api/plant-reviews.spec.ts` — author-only DELETE | **fail** | **BUG-007**: non-author DELETE returns 204 instead of 404 “Review not found” (unsigned still 401; author delete 204 works) |
| PR-02 | `tests/api/plant-reviews.spec.ts` — POST requires session / unknown plant | **pass** | — |
| PR-03 | `web/cypress/ui/plant-page-reviews-signed-out.cy.ts` (PR03-01…03) | **pass** (3/3) | — |
| PR-04 | `tests/api/plant-reviews.spec.ts` — one review per customer per plant | **pass** | — |
| PR-05 | `tests/api/plant-reviews.spec.ts` — GET list / average / empty | **fail** (partial) | **BUG-008**: average 4.6 vs expected 4.7 for 5+4+5. Schema, count, newest-first, empty plant, and unknown plant **pass** (PR-05a/c) |
| PR-06 | `tests/api/plant-reviews.spec.ts` — POST body validation | **pass** | — |
| PR-07 | `web/cypress/component/ReviewList.cy.tsx` (RL-01…04) | **pass** (4/4) | — |
| PR-08 | `web/cypress/component/ReviewForm.cy.tsx` (RF-01…06) | **pass** (6/6) | — |
| PR-09 | `web/cypress/component/StarRatingInput.cy.tsx` (SR-01…03) | **fail** (2/3) | **BUG-009**: SR-03 — missing `aria-checked` / keyboard radio semantics |
| PR-10 | `web/cypress/ui/plant-page-reviews-signed-in.cy.ts` (PR10-01…06) | **fail** (5/6) | **BUG-010**: PR10-02 — toast shows but list does not refetch after POST (wrong query key) |
| PR-11 | `tests/e2e/plant-reviews.spec.ts` | **fail** (partial 4/6) | **BUG-008** (UI average 4.6); **BUG-010** (toast without list refresh). Pass: seeded list/order, signed-out invite+link, second-review blocked |
| PR-12 | `tests/a11y/pages.spec.ts` — Plant Reviews signed out / signed in | **fail** (0/2) | Signed-out: existing **BUG-006** (`image-alt`, `color-contrast`) on plant page. Signed-in: same plus **BUG-009** (`aria-required-attr` on star radios) |
| PR-13 | Delete review UI | **skipped** | **Open question**: feature doc requires author-only delete, but plant-page slot has no delete control — UI needed or API-only? |

## Totals (executed tests)

| Suite | Passed | Failed | Notes |
| --- | ---: | ---: | --- |
| Playwright API (`plant-reviews`) | 6 | 2 | PR-01, PR-05b |
| Playwright e2e (`plant-reviews`) | 4 | 2 | average; list refresh |
| Playwright a11y (PR-12 scans) | 0 | 2 | plant page + star radios |
| Cypress component + UI | 20 | 2 | SR-03; PR10-02 |
| **Overall** | **30** | **8** | PR-13 not executed |

## Commands

```bash
npx playwright test tests/api/plant-reviews.spec.ts --project=api --workers=1
npx playwright test tests/e2e/plant-reviews.spec.ts --project=e2e --workers=1
npx playwright test tests/a11y/pages.spec.ts -g "Plant Reviews" --project=a11y --workers=1
npx cypress run --component --project web --spec 'web/cypress/component/ReviewList.cy.tsx,web/cypress/component/ReviewForm.cy.tsx,web/cypress/component/StarRatingInput.cy.tsx'
npx cypress run --e2e --project web --spec 'web/cypress/ui/plant-page-reviews-signed-out.cy.ts,web/cypress/ui/plant-page-reviews-signed-in.cy.ts'
```

## Findings logged

- **BUG-007** — non-author can delete any review
- **BUG-008** — average truncates (4.6) instead of half-up (4.7)
- **BUG-009** — StarRatingInput not a keyboard-operable radio group
- **BUG-010** — post success does not invalidate `['reviews', …]` so list stays stale
- **PR-13** open question noted in `FINDINGS.md`
