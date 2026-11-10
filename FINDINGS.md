# Findings

## Entry format

One entry per issue, ordered by severity (money and privacy first, then broken flows, then everything else):

- **Title:** one line — what is wrong
- **Where:** the page, component, or endpoint
- **Category:** Components / Pages / Business rules in the API / The contract / Caching / Authorization / Accessibility
- **Impact:** one sentence on the customer
- **Evidence:** the test that fails, or the exact steps and requests
- **Contradicts:** the line in `docs/PRODUCT.md` or the API contract
- **Suggested fix:** optional, one line

## Bugs

### BUG-001: + stays enabled at the stock limit

| Field | Detail |
| --- | --- |
| **Severity** | Medium — broken flow (customer can request more than stock) |
| **Where** | Component: `QuantityStepper` (`web/src/components/QuantityStepper.tsx`) |
| **Category** | Components |
| **Impact** | A customer can still click **+** when quantity already equals stock, so the UI invites a quantity the shop should refuse. |
| **Expected** | At the stock limit, **+** is disabled (`docs/PRODUCT.md` line 34). |
| **Actual** | With `value={3}` and `max={3}`, **Increase quantity** stays enabled. The button only disables when `value > max`. |
| **Evidence** | `npm run cy:component` — `QuantityStepper` / `+ is disabled at the stock limit` fails. Screenshot: `web/cypress/screenshots/QuantityStepper.cy.tsx/QuantityStepper -- + is disabled at the stock limit (failed).png`. UI: `web/cypress/ui/cart.cy.ts` **CP-12** is tagged `@known-bug` (skipped by default `npm run cy:ui`). |
| **Contradicts** | `docs/PRODUCT.md` line 34 — “at the stock limit, the **+** button is disabled.” |
| **Suggested fix** | Disable **+** when `value >= max` (not only when `value > max`). |

### BUG-002: Browse hides catalog load failures as “no plants”

| Field | Detail |
| --- | --- |
| **Severity** | Medium — broken flow (customer cannot retry when the catalog is down) |
| **Where** | Page: Browse (`web/src/pages/BrowsePage.tsx`) |
| **Category** | Pages |
| **Impact** | When `GET /api/plants` fails, the shop looks like an empty filter result instead of telling the customer the catalog could not load. |
| **Expected** | Error message with **Try again** (`docs/PRODUCT.md` line 27). |
| **Actual** | On HTTP 500, heading shows `0 plants` and **No plants match your filters** with no **Try again** button. |
| **Evidence** | `npm run cy:ui` — `Browse /` / `shows an error alert and Try again when the catalog request fails` fails (no `role="alert"`). |
| **Contradicts** | `docs/PRODUCT.md` line 27 — catalog can't be loaded → say so and offer **Try again**; never pretend there are no plants. |
| **Suggested fix** | On `plants.isError`, render `ErrorBanner` with retry (refetch), not `EmptyState`. |

### BUG-003: Prices omit trailing zeros (`$24.5`, `$22`, `$0`)

| Field | Detail |
| --- | --- |
| **Severity** | Low — display (money formatting) |
| **Where** | Component: `PriceTag` via `formatPrice` (`web/src/money.ts`) |
| **Category** | Components |
| **Impact** | Catalog and cart prices often show one decimal or no cents, so amounts look inconsistent and do not match the shop’s stated format. |
| **Expected** | Two decimals everywhere, e.g. `$24.50`, `$12.50`, `$22.00`, `$0.00` (`docs/PRODUCT.md` line 31). |
| **Actual** | `formatPrice` renders `$${Math.round(amount * 100) / 100}`, so `24.5` → `$24.5`, `22` → `$22`, `0` → `$0`, `12.5` → `$12.5`. |
| **Evidence** | `npm run cy:component` — `PriceTag` / `PT-01`, `PT-02`, `PT-03`, `PT-05`, `PT-12` fail (screenshots under `web/cypress/screenshots/PriceTag.cy.tsx/`). Also `npm run cy:ui` — `Browse /` / `shows a zero price as $0.00 on the card` fails. |
| **Contradicts** | `docs/PRODUCT.md` line 31 — “Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`.” |
| **Suggested fix** | Format with fixed two fractional digits (e.g. `toFixed(2)`), as in the `formatPrice` JSDoc. |

### BUG-004: GET /api/plants/{plantId} returns rating as a string

| Field | Detail |
| --- | --- |
| **Severity** | Medium — contract drift (clients and contract tests cannot rely on types) |
| **Where** | API: `store.getPlant` (`api/src/store.ts`) |
| **Category** | The contract |
| **Impact** | `rating` is serialized as a string (e.g. `"4.7"`) while the published **`Plant`** schema in `/openapi.json` describes **`rating` as a number**. |
| **Expected** | JSON matches the **`Plant`** component schema from `/openapi.json`. |
| **Actual** | Response includes `"rating": "4.7"` (string) from `plant.rating.toFixed(1)`. |
| **Evidence** | `npm run test:pw` — `tests/api/plants.spec.ts` / `GET one plant matches OpenAPI Plant` fails with `Schema Plant validation failed: /rating must be number`. |
| **Contradicts** | OpenAPI `Plant` → `rating` (number); `docs/PRODUCT.md` defers field shapes to `/openapi.json`. |
| **Suggested fix** | Return a numeric `rating` (or change the published schema to match the runtime type — preferably fix the response). |

### BUG-005: sort=price-desc orders ascending like price-asc

| Field | Detail |
| --- | --- |
| **Severity** | Medium — browse and API disagree with product sort |
| **Where** | API: `store.listPlants` (`api/src/store.ts`) |
| **Category** | Business rules in the API |
| **Impact** | Choosing **Price: high to low** still returns lowest-priced plants first in the first page of results. |
| **Expected** | `sort=price-desc` — highest price first (`docs/PRODUCT.md` browse **Sort by**; OpenAPI `/api/plants` description). |
| **Actual** | `price-asc` and `price-desc` share `results.sort((a, b) => a.price - b.price)`. |
| **Evidence** | `npm run test:pw` — `tests/api/plants.spec.ts` / `GET browse with sort=price-desc returns most expensive plant first` fails (first price `0.99`, expected highest); `tests/e2e/browse.spec.ts` / `sorting by Price: high to low…` fails for the same ordering. |
| **Contradicts** | `docs/PRODUCT.md` — “**Price: high to low (most expensive first)**”; OpenAPI description for `/api/plants`. |
| **Suggested fix** | For `price-desc`, sort by `b.price - a.price` (or equivalent). |

### BUG-006: Axe reports critical/serious WCAG issues (buttons, search label, hero image, price contrast)

| Field | Detail |
| --- | --- |
| **Severity** | High — accessibility (screen readers and low-vision users blocked on key controls and prices) |
| **Where** | Browse (`PlantCard` save buttons, search field), plant detail (hero `img`, `PriceTag`), cart and checkout (`PriceTag` / order summary) |
| **Category** | Accessibility |
| **Impact** | Save toggles have no discernible name; search has no accessible name; plant hero image has no `alt`; price text fails color-contrast against the background. |
| **Expected** | Every control has an accessible name; meaningful images have alternative text; text meets contrast minimums (`docs/PRODUCT.md` — accessible names; meaningful images). |
| **Actual** | `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` reports `button-name` (save buttons), `label` (`.SearchBox-module__input`), `image-alt` (plant hero), and `color-contrast` (`.PriceTag-module__price` and related). |
| **Evidence** | `npx playwright test --project=a11y` — fails on Browse, Plant, Cart, Checkout; passes Setup and Sign in. Attachments on failure: `axe-results` (JSON), `axe-shot:<page>:<rule>:<index>` (PNG). |
| **Contradicts** | `docs/PRODUCT.md` and listed Suspicions (save buttons, search field, plant hero `alt`, price contrast). |
| **Suggested fix** | Add `aria-label` (or visible text) to save toggles; associate `label` with search input or use `aria-label`; set descriptive `alt` on plant images; adjust `PriceTag` / theme colors to meet contrast. |

### BUG-007: Anyone signed in can delete any review

| Field | Detail |
| --- | --- |
| **Severity** | High — privacy / authorization |
| **Where** | API: `DELETE /api/reviews/{reviewId}` (`api/src/features/plant-reviews.ts`) |
| **Category** | Authorization |
| **Impact** | Another signed-in customer can remove someone else’s review. |
| **Expected** | Only the author can delete; anyone else gets **Review not found** (`docs/features/plant-reviews.md`; OpenAPI delete description). |
| **Actual** | Handler requires a session, then deletes by id with no `userId` check, so a non-author gets **204**. |
| **Evidence** | `npx playwright test tests/api/plant-reviews.spec.ts --project=api --workers=1` — **PR-01** fails: non-author delete expected **404**, received **204**. |
| **Contradicts** | `docs/features/plant-reviews.md` — “Only the author can delete a review. Anyone else gets Review not found.”; OpenAPI `DELETE /api/reviews/{reviewId}`. |
| **Suggested fix** | After finding the review, if `review.userId !== user.id` (or missing author), throw the same 404 as unknown id. |

### BUG-008: Review average truncates instead of rounding half-up (4.6 vs 4.7)

| Field | Detail |
| --- | --- |
| **Severity** | Medium — business rules in the API |
| **Where** | API: `GET /api/plants/{plantId}/reviews` average (`api/src/features/plant-reviews.ts`) |
| **Category** | Business rules in the API |
| **Impact** | Shoppers see a lower average than the feature promises (seed Snake Plant shows **4.6** instead of **4.7**). |
| **Expected** | Average rounded to one decimal, halves up: ratings 5, 4, 5 → **4.7** (`docs/features/plant-reviews.md`). |
| **Actual** | Uses `Math.floor((sum / n) * 10) / 10`, so 4.666… → **4.6**. |
| **Evidence** | `npx playwright test tests/api/plant-reviews.spec.ts --project=api --workers=1` — **PR-05b** fails (`average` 4.6 vs 4.7); e2e average assertion also fails. |
| **Contradicts** | `docs/features/plant-reviews.md` — “The average is rounded to one decimal, halves up… show as **4.7**.” |
| **Suggested fix** | Round half-up to one decimal (e.g. `Math.round(avg * 10) / 10`), not `Math.floor`. |

### BUG-009: StarRatingInput lacks radio selected-state and keyboard behavior

| Field | Detail |
| --- | --- |
| **Severity** | High — accessibility |
| **Where** | Component: `StarRatingInput` (`web/src/components/StarRatingInput.tsx`) |
| **Category** | Accessibility |
| **Impact** | Keyboard and screen-reader users cannot operate the rating like a radio group. |
| **Expected** | Tab into the group, arrow keys change rating, selected star announced (`aria-checked` / roving tabindex) (`docs/features/plant-reviews.md`). |
| **Actual** | Stars are click-only `role="radio"` spans with no `aria-checked`, no `tabindex`, no key handlers. Axe also reports `aria-required-attr` on each star. |
| **Evidence** | `npx cypress run --component` — **SR-03** fails (`aria-checked` undefined). `npx playwright test … -g "Plant Reviews"` — signed-in scan: `aria-required-attr` on `span[aria-label="N star(s)"]`. |
| **Contradicts** | `docs/features/plant-reviews.md` — keyboard radio-group behavior; `docs/PRODUCT.md` Accessibility. |
| **Suggested fix** | Implement radiogroup semantics: `aria-checked`, roving `tabindex`, arrow-key handlers (and Space/Enter). |

### BUG-010: Posted review does not appear in the list right away

| Field | Detail |
| --- | --- |
| **Severity** | Medium — broken flow |
| **Where** | Slot: `web/src/slots/plant-page/reviews.tsx` |
| **Category** | Pages / Caching |
| **Impact** | After posting, the customer sees the thank-you toast but their review is missing until a full reload. |
| **Expected** | After posting, the review appears in the list right away (`docs/features/plant-reviews.md`). |
| **Actual** | Toast **Thanks for your review!** shows, but the reviews query is not refetched. `invalidateQueries({ queryKey: ['review', plant.id] })` does not match `['reviews', plant.id]`. |
| **Evidence** | Cypress UI **PR10-02** fails waiting for `@reviewsAfterPost`. Playwright e2e post test: toast visible, **Ava Green** never appears in the list. |
| **Contradicts** | `docs/features/plant-reviews.md` — “After posting, the review appears in the list right away”. |
| **Suggested fix** | Invalidate `['reviews', plant.id]` (or both keys) on successful POST. |

## Open questions

- **PR-13:** Feature doc requires author-only delete, but the plant-page Reviews slot has no delete control. Should UI expose delete for the author, or is API-only enough?

## Suspicions — not yet tested

- Browse shows `$27.5` (and plant size deltas `+$6`) instead of two decimals — PRODUCT: “Every price is shown in dollars with two decimals, everywhere.” (Component evidence for `$12.5` / `$22` / `$0`: **BUG-003**.)
- Expert plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) render as “Moderate care” — PRODUCT: “Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**.”
- Following “Likes the same light” from Fiddle Leaf Fig to Rubber Plant left the URL as `/plants/pl-rubber` but the heading still said Fiddle Leaf Fig — PRODUCT: “The plant page always shows the plant in the address bar, including after following a "Likes the same light" link.”
- Free shipping uses `subtotal > 50`, so a cart of exactly `$50.00` would still pay `$6.95` — PRODUCT: “Shipping costs $6.95, and is free when the subtotal is $50.00 or more.”
- `GET /api/orders/{orderId}` ignores the caller and returns any order by id — PRODUCT: “An order is private: only the customer who placed it can see it. Anyone else gets "Order not found".”
- Search field has no accessible name, plant-card save buttons have none, and the plant hero image has no `alt` — PRODUCT: “every button and form field has a name a screen reader can announce” / “every meaningful image has alternative text”. (**Tracked as BUG-006.**)
