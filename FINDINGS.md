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
| **Evidence** | `npx playwright test --project=a11y` — fails on Browse, Plant, Cart, Checkout; passes Setup and Sign in. Attachments on failure: `axe-results` (JSON), `axe-shot:<page>:<rule>:<index>` (PNG). Also PC-14 checkout-with-discount scan (`name: checkout`) — PriceTag contrast still blocking (no checkout baseline). |
| **Contradicts** | `docs/PRODUCT.md` and listed Suspicions (save buttons, search field, plant hero `alt`, price contrast). |
| **Suggested fix** | Add `aria-label` (or visible text) to save toggles; associate `label` with search input or use `aria-label`; set descriptive `alt` on plant images; adjust `PriceTag` / theme colors to meet contrast. |

### BUG-007: Percent promo discounts shipping as well as plants

| Field | Detail |
| --- | --- |
| **Severity** | High — money (customer undercharged / shipping wrongly discounted) |
| **Where** | API: `store.cart` (`api/src/store.ts`) percent promo branch |
| **Category** | Business rules in the API |
| **Impact** | `LEAFY10` takes 10% of **subtotal + shipping**, so shipping is discounted and plant savings are wrong. |
| **Expected** | Percentage off the **plant subtotal only**, never shipping (`docs/features/promo-codes.md`). |
| **Actual** | `discount = toCents(((subtotal + shipping) * percent) / 100)` — e.g. $22 + $6.95 → discount `$2.90` instead of `$2.20`. |
| **Evidence** | `npx playwright test --project=api tests/api/promo.spec.ts` — **PC-01** fails (expected `2.2`, got `2.9`); **PC-03b** under-$50 discount assertion fails similarly. |
| **Contradicts** | `docs/features/promo-codes.md` — “percentage code takes that percentage off the subtotal of the plants — never off shipping.” |
| **Suggested fix** | Compute percent discount from `subtotal` only (exclude `shipping`). |

### BUG-008: Expired promo `SPRING5` is accepted

| Field | Detail |
| --- | --- |
| **Severity** | Medium — money / promo integrity |
| **Where** | API: `findPromo` (`api/src/promos.ts`) |
| **Category** | Business rules in the API |
| **Impact** | Customers can still apply `SPRING5` after its expiry and receive a discount. |
| **Expected** | Expired codes refused with a message that the code has expired (`promo_invalid`). |
| **Actual** | `findPromo` never checks `expiresAt`; `POST /api/cart/promo` with `SPRING5` returns **200**. |
| **Evidence** | `tests/api/promo.spec.ts` **PC-05** (expected 400, got 200); `tests/e2e/promo.spec.ts` **PC-12a** (no “expired” message on `/cart`). |
| **Contradicts** | `docs/features/promo-codes.md` — “Expired codes are refused, with a message that says the code has expired.” |
| **Suggested fix** | Reject when today is after `expiresAt`, with `promo_invalid` and detail mentioning expired. |

### BUG-009: Free shipping threshold uses `subtotal > 50` (not ≥ $50)

| Field | Detail |
| --- | --- |
| **Severity** | Medium — money (shipping charged at exactly $50.00) |
| **Where** | API: `store.cart` (`api/src/store.ts`) |
| **Category** | Business rules in the API |
| **Impact** | A cart whose plant subtotal is exactly `$50.00` still pays `$6.95` shipping. |
| **Expected** | Free shipping when subtotal is **$50.00 or more** (`docs/PRODUCT.md`). |
| **Actual** | `subtotal > FREE_SHIPPING_FROM` → Bird of Paradise S (`$50`) gets shipping `$6.95`. |
| **Evidence** | `tests/api/promo.spec.ts` **PC-03a** — expected shipping `0`, got `6.95`. |
| **Contradicts** | `docs/PRODUCT.md` — “free when the subtotal is $50.00 or more.” |
| **Suggested fix** | Use `subtotal >= FREE_SHIPPING_FROM`. |

### BUG-010: Promo code field lacks accessible name; refused errors not announced

| Field | Detail |
| --- | --- |
| **Severity** | High — accessibility (new cart control) |
| **Where** | Component: `PromoCodeInput` (`web/src/components/PromoCodeInput.tsx`); cart slot |
| **Category** | Accessibility |
| **Impact** | Screen-reader users cannot identify the promo field; refused-code messages are not announced when they appear. |
| **Expected** | Visible accessible name for the code field; refused message announced via `aria-live` / alert (`docs/features/promo-codes.md`, PRODUCT WCAG). |
| **Actual** | Bare `<input>` (axe `label`); error is a plain `<p>` without `role="alert"` / `aria-live`. |
| **Evidence** | `npm run cy:component` — **PI-06** fails; `npx playwright test --project=a11y` — **PC-13** promo field / error scans report critical `label` on the promo input. |
| **Contradicts** | `docs/features/promo-codes.md` — visible label; “message is announced to screen-reader users as soon as it appears.” |
| **Suggested fix** | Associate a `<label>` (or `aria-label`) with the input; put the error in an alert / live region. |

## Suspicions — not yet tested

- Browse shows `$27.5` (and plant size deltas `+$6`) instead of two decimals — PRODUCT: “Every price is shown in dollars with two decimals, everywhere.” (Component evidence for `$12.5` / `$22` / `$0`: **BUG-003**.)
- Expert plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) render as “Moderate care” — PRODUCT: “Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**.”
- Following “Likes the same light” from Fiddle Leaf Fig to Rubber Plant left the URL as `/plants/pl-rubber` but the heading still said Fiddle Leaf Fig — PRODUCT: “The plant page always shows the plant in the address bar, including after following a "Likes the same light" link.”
- `GET /api/orders/{orderId}` ignores the caller and returns any order by id — PRODUCT: “An order is private: only the customer who placed it can see it. Anyone else gets "Order not found".”
- Search field has no accessible name, plant-card save buttons have none, and the plant hero image has no `alt` — PRODUCT: “every button and form field has a name a screen reader can announce” / “every meaningful image has alternative text”. (**Tracked as BUG-006.**)
