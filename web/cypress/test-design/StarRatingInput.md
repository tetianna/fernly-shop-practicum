# StarRatingInput — component test design

Component: `web/src/components/StarRatingInput.tsx`  
Props: `value` (number), `onChange(value: number)`.  
Used in: `ReviewForm`.

**Status:** approved

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SR-01 | positive | `value={0}` | click **4 stars** radio | `onChange(4)`; stars 1–4 appear filled (selected styling) | docs/features/plant-reviews.md — star rating | interaction |
| SR-02 | accessibility | `value={0}` | mount | `role="radiogroup"` named **Your rating**; five `role="radio"` named **1 star** / **N stars** | docs/features/plant-reviews.md; docs/PRODUCT.md Accessibility | accessibility (names) |
| SR-03 | accessibility | `value={3}` | Tab into group, use arrow keys | selection moves like a radio group; selected star has `aria-checked="true"` / roving tabindex; SR-relevant selected state updates | docs/features/plant-reviews.md — “works with the keyboard like any group of radio buttons” | accessibility (keyboard) |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
