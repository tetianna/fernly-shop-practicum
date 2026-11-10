# Checkout & order detail — promo discount UI

Pages: `web/src/pages/CheckoutPage.tsx`, `web/src/pages/OrdersPage.tsx` (order detail)  
Routes: `/checkout`, `/orders/:orderId`

**Status:** approved (from `docs/test-plans/feature/promo-codes.md` PC-11)

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| CO-01 | positive | Signed in; mocked cart/checkout payload with `promoCode` + `discount` > 0 | open `/checkout` | order summary shows discount line and total including discount | promo-codes.md; APP-MAP checkout | positive |
| CO-02 | positive | Signed in; mocked order with `promoCode`/`discount` | open order detail | **Paid** / summary shows discount and code | promo-codes.md — order keeps discount | positive |
| CO-03 | negative | Signed in; cart/order with `discount` 0 / omitted | open checkout or order | no discount row | promo-codes.md PC-11 | negative (no row) |

After **approved**, implement with **cypress-test-writer** under `web/cypress/ui/`. Do not change `web/src`; log bugs in `FINDINGS.md`.
