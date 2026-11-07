---
name: component-test-design
description: Designs Cypress tests for one React component or one page as a table a human approves, from the component's props, docs/PRODUCT.md and docs/APP-MAP.md, before any test code exists. Use when the user asks what to test in a component or a page, asks for component tests, UI states, edge cases, or test ideas for the Fernly UI. Writes web/cypress/test-design/<Name>.md and stops for approval. Do NOT use to write test code — that is the cypress-test-writer subagent.
paths: "web/**"
---

# Component test design

1. **Component:** read its props in `web/src/components` and where it's used. **Page:** read its API calls in `docs/APP-MAP.md`.
2. Write **`web/cypress/test-design/<Name>.md`** with one table:

   **ID | kind** (render / state / interaction / boundary / accessibility, or for a page: positive / negative / edge) **| given** (props, or the API answer) **| the user does | expected | source** (a PRODUCT.md line, or "the component's purpose") **| technique**.

3. **Techniques**, named in their column: equivalence classes over each prop; boundaries (0, 1, the limit, one past it); states (disabled, loading, empty, error); callbacks (called with what); accessibility basics (every control has a role and a name).
4. A **page** gets at least: a normal answer, an empty answer, an error (500), signed out (401), and an extreme value (a very long name, price 0, a slow answer).
5. What no document says: a row marked **`assumed — ask`**, with no expected result.
6. **Stop.** Show the table and wait for **`approved`** or changes. **Write no test code.**

Oracle: `docs/PRODUCT.md` for expected UI behavior. After approval, hand off to the **cypress-test-writer** subagent — not this skill.

## PriceTag calibration (auto-invoke check)

If the user asks what to test in **PriceTag** without naming this skill, still follow steps 1–6. Include **boundary** rows such as `amount={12.5}`, `{22}`, `{0.99}` with **source** `docs/PRODUCT.md` — two decimals (`$12.50`, never `$12.5`; whole dollars like `$22.00`). Cover `size` classes and optional `label` (visually hidden) via equivalence / accessibility rows.
