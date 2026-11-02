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

## Suspicions — not yet tested

- Browse shows `$22`, `$12.5`, `$27.5` (and plant size deltas `+$6`) instead of two decimals — PRODUCT: “Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`.”
- Expert plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) render as “Moderate care” — PRODUCT: “Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**.”
- Following “Likes the same light” from Fiddle Leaf Fig to Rubber Plant left the URL as `/plants/pl-rubber` but the heading still said Fiddle Leaf Fig — PRODUCT: “The plant page always shows the plant in the address bar, including after following a "Likes the same light" link.”
- Browse treats a catalog failure the same as zero results (“No plants match your filters”, no Try again) — PRODUCT: “If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants.”
- API `price-desc` sorts with the same `a.price - b.price` as `price-asc` — PRODUCT: “Price: high to low (most expensive first)”.
- Free shipping uses `subtotal > 50`, so a cart of exactly `$50.00` would still pay `$6.95` — PRODUCT: “Shipping costs $6.95, and is free when the subtotal is $50.00 or more.”
- `GET /api/orders/{orderId}` ignores the caller and returns any order by id — PRODUCT: “An order is private: only the customer who placed it can see it. Anyone else gets "Order not found".”
- Search field has no accessible name, plant-card save buttons have none, and the plant hero image has no `alt` — PRODUCT: “every button and form field has a name a screen reader can announce” / “every meaningful image has alternative text”.
