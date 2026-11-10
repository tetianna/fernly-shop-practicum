# PromoCodeInput — component test design

Component: `web/src/components/PromoCodeInput.tsx`  
Props: `appliedCode`, `onApply`, `onRemove`, `error?`, `busy?`.  
Used on: Cart via `web/src/slots/cart-summary/promo-code.tsx`.

**Status:** approved (from `docs/test-plans/feature/promo-codes.md` PC-09)

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PI-01 | interaction | `appliedCode={null}`, spies for callbacks | type `LEAFY10`, click **Apply** | `onApply` called with trimmed `LEAFY10` | promo-codes.md — Apply | interaction (apply) |
| PI-02 | interaction | `appliedCode="LEAFY10"` | click **Remove** | `onRemove` called; shows code applied + Remove | promo-codes.md — Remove | interaction (remove) |
| PI-03 | state | empty / whitespace-only input | observe Apply | **Apply** disabled; submit does not call `onApply` | promo-codes.md PC-09 | state (empty) |
| PI-04 | negative | `error="We don't recognize this code."` | mount | error message visible | promo-codes.md — refused codes | negative (error shown) |
| PI-05 | edge | `busy={true}`, with and without applied code | mount | Apply and/or Remove disabled while busy | promo-codes.md PC-09 | edge (busy) |
| PI-06 | accessibility | no applied code | mount | code field has a visible accessible name; when `error` is set, message is announced to AT (`role="alert"` or `aria-live`) | promo-codes.md — visible label; SR announcement; PRODUCT.md WCAG | accessibility |

After **approved**, implement with **cypress-test-writer**. Do not change `web/src`; log bugs in `FINDINGS.md`.
