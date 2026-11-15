# Cart page — promo code UI test design

Page: `web/src/pages/CartPage.tsx` + slot `web/src/slots/cart-summary/promo-code.tsx`  
Route: `/cart` (signed-in)  
APIs: `GET /api/cart`, `POST /api/cart/promo`, `DELETE /api/cart/promo`

**Status:** approved (from `docs/test-plans/feature/promo-codes.md` PC-10)

**Harness notes:** Signed-in token + stubbed `GET /api/auth/me`. Intercept cart and promo routes. Prefer `findByRole` / `findByLabelText`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| CPR-01 | positive | Signed in; cart one line, no promo | open `/cart` | promo code field + **Apply** under order summary | promo-codes.md; APP-MAP `/cart` | positive (input present) |
| CPR-02 | positive | Signed in; stub Apply → cart with `promoCode` LEAFY10 and `discount` | type code, Apply | summary shows **Discount (LEAFY10)** and updated total from mock | promo-codes.md | positive (apply updates summary) |
| CPR-03 | positive | Signed in; cart already has promo | click **Remove**; stub DELETE clears promo | discount line gone; input returns | promo-codes.md — Remove | positive (remove) |
| CPR-04 | negative | Signed in; Apply returns 400 with detail | Apply invalid code | error message shown in UI | promo-codes.md — refused | negative |
| CPR-05 | edge | Signed in; Apply pending (delay) | click Apply | control disabled while busy/pending | promo-codes.md PC-10 edge | edge (busy) |

After **approved**, implement with **cypress-test-writer** under `web/cypress/ui/`. Do not change `web/src`; log bugs in `FINDINGS.md`.
