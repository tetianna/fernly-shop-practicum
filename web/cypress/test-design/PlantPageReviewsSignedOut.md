# Plant page Reviews slot (signed out) — UI test design

Page: Plant detail with Reviews slot (`web/src/pages/PlantPage.tsx` + `web/src/slots/plant-page/reviews.tsx`)  
Route: `/plants/:plantId`  
Data: `GET /api/plants/:id`, `GET /api/plants/:id/reviews` (mocked)

**Status:** approved

**Harness notes:** Leave signed out (no `fernly_token`). Intercept plant and reviews fixtures. Assert with Testing Library queries.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| PR03-01 | positive | Signed out; plant + reviews fixtures load | open `/plants/{id}` | link **Sign in** to write a review points to `/login?next=/plants/{id}` | docs/features/plant-reviews.md — Sign in to write a review | equivalence |
| PR03-02 | negative | Signed out; same fixtures | open `/plants/{id}` | **Write a review** form / **Post review** not shown | docs/features/plant-reviews.md — form only when signed in | negative |
| PR03-03 | accessibility | Signed out; same fixtures | open `/plants/{id}` | Sign-in link is named and keyboard-reachable (`findByRole('link', { name: /sign in/i })`) | docs/PRODUCT.md Accessibility | accessibility |

After **approved**, implement with **cypress-test-writer** from this file. Do not change `web/src` to match failing expectations; log app bugs in `FINDINGS.md`.
