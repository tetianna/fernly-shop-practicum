# OrderSummary — component test design

Component: `web/src/components/OrderSummary.tsx`  
Props: `itemCount`, `subtotal`, `shipping`, `total`, optional `discount`, `promoCode`, `title?`.  
Used on: Cart, Checkout, Orders (`docs/APP-MAP.md`).

**Status:** approved (from `docs/test-plans/feature/promo-codes.md` PC-08)

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| OS-01 | render | `discount={4}`, `promoCode="LEAFY10"`, typical subtotal/shipping/total | mount | discount row label **Discount (LEAFY10)**; amount shows **−$4.00** (two decimals) | promo-codes.md — `Discount (LEAFY10) −$4.00`; PRODUCT.md two decimals | equivalence (percent discount shown) |
| OS-02 | render | `discount={0}` or discount omitted | mount | no discount row | promo-codes.md — discount line only when discount applies | state (no discount) |
| OS-03 | edge | `discount={4}`, `promoCode={null}` | mount | row label **Discount** without parentheses / code | promo-codes.md PC-08 edge | edge (discount without code) |
| OS-04 | accessibility | non-zero discount with code | mount | summary named via heading **Order summary** (or `title`); money amounts readable | PRODUCT.md accessible names; promo-codes.md | accessibility |

After **approved**, implement with **cypress-test-writer**. Do not change `web/src`; log bugs in `FINDINGS.md`.
