# ReviewForm — component test design

Component: `web/src/components/ReviewForm.tsx`  
Props: `onSubmit(review: { rating, text })`, `busy?`, `error?`.  
Children: `StarRatingInput`. Used on: Plant page Reviews slot when signed in.

**Status:** approved

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| RF-01 | positive | default form | choose 4 stars, type ≥10 chars, click **Post review** | `onSubmit` called with `{ rating: 4, text }`; rating cleared and textarea empty | docs/features/plant-reviews.md — Write a review | interaction |
| RF-02 | negative | rating still 0, text long enough | click **Post review** | alert **Choose a rating from 1 to 5 stars.**; `onSubmit` not called | docs/features/plant-reviews.md — 1–5 star rating | negative (validation) |
| RF-03 | negative | rating set, text shorter than 10 after trim | click **Post review** | alert **Write at least 10 characters.**; `onSubmit` not called | docs/features/plant-reviews.md — 10–500 characters | negative (validation) |
| RF-04 | edge | `busy={true}` | mount | submit button disabled and labelled **Posting…** | docs/features/plant-reviews.md / PRODUCT busy norms | state (busy) |
| RF-05 | negative | `error="Server said no"` | mount | `role="alert"` shows that message | PRODUCT error norms | negative (API error) |
| RF-06 | accessibility | default form | mount | textarea labelled **Your review** | docs/PRODUCT.md — named controls | accessibility |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
