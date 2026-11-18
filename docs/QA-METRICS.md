# QA metrics

Generated: 2026-11-12T23:56:34.975Z

**Totals:** Routing accuracy: 95.2% (20/21 rows); false-alarm rate: n/a (0/0 findings).

| PR | Rows right | Rows reviewed | Min to plan | Min to QA report | Agent min | Findings | False alarms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [Feature: Add promo codes](https://github.com/vskadorva/fernly-shop-practicum/pull/1) (#1) | 20 | 21 | 9 | — | 89 | 0 | 0 |
| [Feature: Add back-in-stock badges and sign-up](https://github.com/vskadorva/fernly-shop-practicum/pull/6) (#6) | — | — | 37 | 2 | 147 | 0 | 0 |

## How each number is measured

- **Rows right / rows reviewed:** Parsed from the latest human PR comment whose body starts with `Plan review: N/M`.
- **Min to plan:** Minutes from PR `createdAt` to the first `github-actions[bot]` issue comment that is not a QA report (`<!-- fernly-qa-report -->`).
- **Min to QA report:** Minutes from PR `createdAt` to the first issue comment whose body is a QA report (`<!-- fernly-qa-report -->`).
- **Agent min:** Sum of wall-clock minutes (`updatedAt − createdAt`) for **completed** `pr-triage.yml` workflow runs on the PR head branch.
- **Findings:** Open or closed issues labeled `qa-finding` whose body links to the PR (same `pull/N` URL).
- **False alarms:** Those findings closed with GitHub state reason **Not planned** (`NOT_PLANNED`).
- **Routing accuracy:** Σ rows right ÷ Σ rows reviewed across all `plan-approved` pull requests.
- **False-alarm rate:** Σ false alarms ÷ Σ findings.

## Cost

Agent spend is not available in GitHub. See the [Cursor dashboard](https://cursor.com/dashboard) for usage and billing.
