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
| **Evidence** | `npm run cy:component` — `QuantityStepper` / `+ is disabled at the stock limit` fails. Screenshot: `web/cypress/screenshots/QuantityStepper.cy.tsx/QuantityStepper -- + is disabled at the stock limit (failed).png`. |
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

### BUG-003: Zero price shows `$0` instead of `$0.00`

| Field | Detail |
| --- | --- |
| **Severity** | Low — display (money formatting) |
| **Where** | Component: `PriceTag` via `formatPrice` (`web/src/money.ts`) |
| **Category** | Components |
| **Impact** | Free or zero-priced items do not follow the shop’s two-decimal price format. |
| **Expected** | `$0.00` (`docs/PRODUCT.md` line 31). |
| **Actual** | Browse card shows `$0` for `price: 0` in the mocked catalog. |
| **Evidence** | `npm run cy:ui` — `Browse /` / `shows a zero price as $0.00 on the card` fails. |
| **Contradicts** | `docs/PRODUCT.md` line 31 — two decimals everywhere. |
| **Suggested fix** | Format with fixed two fractional digits (e.g. `toFixed(2)`). |

## Suspicions — not yet tested

- Browse shows `$22`, `$12.5`, `$27.5` (and plant size deltas `+$6`) instead of two decimals — PRODUCT: “Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`.”
- Expert plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) render as “Moderate care” — PRODUCT: “Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**.”
- Following “Likes the same light” from Fiddle Leaf Fig to Rubber Plant left the URL as `/plants/pl-rubber` but the heading still said Fiddle Leaf Fig — PRODUCT: “The plant page always shows the plant in the address bar, including after following a "Likes the same light" link.”
- API `price-desc` sorts with the same `a.price - b.price` as `price-asc` — PRODUCT: “Price: high to low (most expensive first)”.
- Free shipping uses `subtotal > 50`, so a cart of exactly `$50.00` would still pay `$6.95` — PRODUCT: “Shipping costs $6.95, and is free when the subtotal is $50.00 or more.”
- `GET /api/orders/{orderId}` ignores the caller and returns any order by id — PRODUCT: “An order is private: only the customer who placed it can see it. Anyone else gets "Order not found".”
- Search field has no accessible name, plant-card save buttons have none, and the plant hero image has no `alt` — PRODUCT: “every button and form field has a name a screen reader can announce” / “every meaningful image has alternative text”.
