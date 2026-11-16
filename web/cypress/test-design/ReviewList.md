# ReviewList — component test design

Component: `web/src/components/ReviewList.tsx`  
Props: `reviews` (array of `{ id, author, rating, text, createdAt }`), `average` (number), `count` (number).  
Used on: Plant page Reviews slot (`web/src/slots/plant-page/reviews.tsx`).

**Status:** approved

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| RL-01 | positive | `average={4.7}`, `count={2}`, two reviews with author/text/`createdAt` | mount | visible summary **4.7 out of 5 · 2 reviews**; each author, text, and formatted date visible | docs/features/plant-reviews.md — Reviews section | equivalence |
| RL-02 | empty | `count={0}`, `average={0}`, `reviews={[]}` | mount | **No reviews yet. Be the first to share how it's growing.**; no average summary | docs/features/plant-reviews.md — no reviews invite | state (empty) |
| RL-03 | edge | `count={1}`, `average={5}`, one review | mount | singular **1 review** (not “reviews”) | docs/features/plant-reviews.md — count wording | boundary (singular) |
| RL-04 | accessibility | one review with `rating={4}` | mount | decorative ★ has `aria-hidden`; visually hidden text **4 out of 5** | docs/features/plant-reviews.md; docs/PRODUCT.md Accessibility | accessibility |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
