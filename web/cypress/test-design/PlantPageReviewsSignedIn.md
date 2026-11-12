# Plant page Reviews slot (signed in) — UI test design

Page: Plant detail with Reviews slot (`web/src/pages/PlantPage.tsx` + `web/src/slots/plant-page/reviews.tsx`)  
Route: `/plants/:plantId`  
Data: `GET /api/plants/:id`, `GET /api/plants/:id/reviews`, `POST /api/plants/:id/reviews` (mocked); stub `GET /api/auth/me` + `fernly_token`

**Status:** approved

**Harness notes:** Same signed-in pattern as CartPage (`localStorage` token + stubbed `/api/auth/me`). Intercept plant/reviews/POST with fixtures or inline bodies; alias requests.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PR10-01 | positive | Signed in; reviews list fixture with average/count/items | open plant page | Reviews heading; average/count copy; review authors/texts visible | docs/features/plant-reviews.md — Reviews section | equivalence |
| PR10-02 | positive | Signed in; list then successful POST + refreshed list | submit valid review | POST fired; list shows new review; toast **Thanks for your review!** | docs/features/plant-reviews.md — appears right away / thanks | interaction |
| PR10-03 | negative | Signed in; `GET` reviews returns 500 | open plant page | **Reviews couldn't be loaded.** and **Try again** | PRODUCT error/retry norms | negative |
| PR10-04 | negative | Signed in; POST returns error detail | submit valid review | form shows API error (`role="alert"`) | PRODUCT error norms | negative |
| PR10-05 | edge | Signed in; delay reviews response briefly | open plant page | **Loading reviews…** visible before list | docs/features/plant-reviews.md / slot copy | state (loading) |
| PR10-06 | edge | Signed in; empty reviews (`count: 0`) | open plant page | empty invite copy and **Write a review** form | docs/features/plant-reviews.md — first review | empty + form |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
