# CartPage — UI test design

Page: `web/src/pages/CartPage.tsx`  
Route: `/cart` (signed-in only; signed-out users redirect to login)  
Data: `GET /api/cart`; updates via `PATCH /api/cart/lines/:lineId`, `DELETE /api/cart/lines/:lineId` (`docs/APP-MAP.md` §1 `/cart`, §3)  
Children: `CartLine`, `OrderSummary`, `EmptyState`, `ErrorBanner`, `Toast` (`web/src/pages/CartPage.tsx`)

**Status:** approved (tests implemented in `web/cypress/ui/cart.cy.ts`)

**Harness notes (for implementation, not part of oracle):** Signed-in flows need a token in `localStorage` and stubbed `GET /api/auth/me` so `AuthProvider` sets `user` before cart runs. Intercept `GET /api/cart` with fixtures; assert with `findByRole` / `findByLabelText` per `.cursor/rules/cypress-tests.mdc`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01 | positive | Signed in; `GET /api/cart` returns one line (name, size, quantities, prices, stock); subtotal &lt; $50, paid shipping | open `/cart` | heading **Your cart**; one list item / article pattern with plant name, **Size** label and size; order summary shows **Subtotal (1 item)**, **Shipping** as **$6.95** (two decimals if UI shows currency), **Total** = subtotal + shipping; link **Go to checkout** | docs/APP-MAP.md `/cart` row; docs/PRODUCT.md §The cart — shipping $6.95 | equivalence (typical 1-line cart) |
| CP-02 | positive | Signed in; cart returns two lines (different plants or sizes), `itemCount` matches sum of quantities | open `/cart` | two line rows visible; summary **Subtotal (N items)** with N = total quantity | docs/APP-MAP.md — lines + summary | equivalence (multi-line) |
| CP-03 | state / boundary | Signed in; non-empty cart with subtotal **exactly $50.00** (fixture totals) | open `/cart` | shipping row shows **Free** (not $0.00 as paid shipping); hint about adding more for free shipping **absent** | docs/PRODUCT.md — "free when the subtotal is $50.00 or more" | boundary (at free-shipping threshold) |
| CP-04 | state / boundary | Signed in; non-empty cart with subtotal **$49.99** | open `/cart` | hint visible: add **$0.01** more for free shipping (amount may reflect **BUG-003** formatting if present) | docs/PRODUCT.md — free shipping from $50; OrderSummary hint | boundary (one cent below threshold) |
| CP-05 | empty | Signed in; `GET /api/cart` returns `lines: []` (empty cart) | open `/cart` | **Your cart is empty**, supporting copy, link **Browse plants** → `/`; no **Go to checkout** | docs/APP-MAP.md `/cart` empty | state (empty) |
| CP-06 | negative | Signed in; `GET /api/cart` returns 500 | open `/cart` | **Your cart couldn't be loaded.**; **Try again**; retry triggers another `GET /api/cart` (alias) | docs/APP-MAP.md `/cart` error | state (error + retry) |
| CP-07 | auth | Signed out (no token or `GET /api/auth/me` 401) | navigate to `/cart` | redirected to login with `next=/cart` (path + query) | docs/APP-MAP.md `/cart` signed out | state (redirect) |
| CP-08 | edge | Signed in; one line with very long `name` | open `/cart` | long name visible and readable (not overlapping controls destructively; same pattern as browse long-name test) | docs/PRODUCT.md — reasonable display; APP-MAP line list | boundary (long string) |
| CP-09 | interaction | Signed in; one line quantity 2, stock 5; stub `PATCH` success | click **Increase quantity** | `PATCH` with new quantity 3; UI shows updated quantity and line total | docs/PRODUCT.md — line quantity; APP-MAP PATCH | interaction (mutation) |
| CP-10 | interaction | Signed in; one line quantity 2; stub `PATCH` with 500 body | click **Decrease quantity** | error **toast** with message; line not lost (still 2 or consistent with API contract) | APP-MAP — Cart error paths; Toast on line update error | negative (mutation failure) |
| CP-11 | interaction | Signed in; one line; stub `DELETE` returns empty cart | click **Remove** | `DELETE` called; empty state **Your cart is empty** + **Browse plants** | docs/APP-MAP.md — remove line | interaction (remove last line) |
| CP-12 | boundary | Signed in; line `quantity` equals `stock` (at max) | open `/cart` | **Increase quantity** disabled; **Decrease quantity** enabled | docs/PRODUCT.md — line cannot exceed stock | state (stepper at max) |
| CP-13 | accessibility | Signed in; non-empty cart | open `/cart` | quantity stepper has accessible name including plant name; **Remove** button has name **Remove &lt;plant&gt;** | docs/PRODUCT.md §Accessibility — control names | accessibility |
| CP-14 | render | Signed in; non-empty cart | open `/cart` | **Order summary** region (`region` / heading **Order summary**); **Go to checkout** link present | APP-MAP — order summary + checkout CTA | render |
| CP-15 | assumed — ask | Signed in; concurrent `PATCH`+`DELETE` or rapid double-click Remove | rapid actions | *(needs human answer: busy/disabled behavior vs duplicate requests)* | — | assumed — ask |

After **approved**, implement with **cypress-test-writer** from this file (UI spec under `web/cypress/ui/`, fixtures under `web/cypress/fixtures/`). Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
