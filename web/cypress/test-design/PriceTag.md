# PriceTag — component test design

Component: `web/src/components/PriceTag.tsx`  
Props: `amount` (required), `size?` (`sm` | `md` | `lg`, default `md`), `label?` (visually hidden prefix).  
Used on: Browse (`PlantCard`), Plant, Cart (`CartLine`, `OrderSummary`), Checkout, Orders (`docs/APP-MAP.md` §2).

**Status:** approved

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PT-01 | render | `amount={24.5}`, default props | mount | visible text `$24.50` | docs/PRODUCT.md — every price in dollars with two decimals | equivalence (typical catalog price) |
| PT-02 | boundary | `amount={12.5}` | mount | visible text `$12.50`, not `$12.5` | docs/PRODUCT.md — `$12.50`, never `$12.5` | boundary (one decimal place in input) |
| PT-03 | boundary | `amount={22}` | mount | visible text `$22.00` | docs/PRODUCT.md — two decimals everywhere | boundary (whole dollars) |
| PT-04 | boundary | `amount={0.99}` | mount | visible text `$0.99` | docs/PRODUCT.md — two decimals everywhere | boundary (sub-dollar) |
| PT-05 | boundary | `amount={0}` | mount | visible text `$0.00` | docs/PRODUCT.md — two decimals everywhere | boundary (zero) |
| PT-06 | boundary | `amount={9999.99}` | mount | visible text `$9999.99` (thousands grouping not specified) | docs/PRODUCT.md — two decimals | boundary (large amount) |
| PT-07 | render | `amount={9.99}`, `size="sm"` | mount | price `$9.99`; root uses small size styling | the component's purpose (unit price on cart lines) | equivalence class (`size=sm`) |
| PT-08 | render | `amount={9.99}`, `size="md"` (default) | mount | price `$9.99`; default medium styling | the component's purpose (browse cards) | equivalence class (`size=md`, default) |
| PT-09 | render | `amount={9.99}`, `size="lg"` | mount | price `$9.99`; large styling | the component's purpose (plant hero price) | equivalence class (`size=lg`) |
| PT-10 | accessibility | `amount={16.94}`, `label="Subtotal"` | mount | visually hidden text includes `Subtotal:`; visible text still `$16.94` only | docs/PRODUCT.md — names screen readers can use; component JSDoc on `label` | accessibility (context label, not shown on screen) |
| PT-11 | accessibility | `amount={16.94}`, no `label` | mount | no hidden label prefix; visible `$16.94` | the component's purpose (price without extra context) | accessibility (price-only display) |
| PT-12 | render | `amount={12.50}` (already two decimal places in data) | mount | `$12.50` | docs/PRODUCT.md — two decimals | equivalence (API-style two-decimal number) |
| PT-13 | assumed — ask | `amount={-1}` | mount | *(no expected — needs human answer)* | — | boundary (negative amount) |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
