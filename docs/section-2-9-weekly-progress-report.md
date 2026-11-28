# Section 2.9 — Weekly progress report

Owner: Mohsin Khan (weekly metrics). Reporting period: **week 48, 23–29 November 2026.** The schedule it is
compared with is test plan §2.2.7.

## 1. Progress against the plan

| Step | Planned (test plan) | Actual | Status |
|---|---|---|---|
| Section 1 scope and test basis | 26 Nov | 26 Nov (merged 27 Nov) | done |
| 2.1 SonarQube and complexity | 27 Nov, 17:00–18:00 | 27 Nov, 16:42–17:20 | done |
| CI skeleton | not in the first plan | 27 Nov, 17:15–17:41 (moved earlier, see 3.1) | done |
| 2.2 plan, risks, traceability | 27 Nov, 18:00–18:30 | 27 Nov, 17:20 | done |
| 2.3 unit tests | 27 Nov, 18:30–20:00 | 28 Nov, 14:25–15:05 | done, **about 19 h late** |
| 2.4 / 2.5 OpenAPI, generator, API tests | 27 Nov, 20:00–21:30 | 28 Nov, 15:05–15:37 | done, late |
| 2.6 use cases and Playwright | 27 Nov, 21:30–22:30 | 28 Nov, 15:40–16:02 | done, late |
| 2.7 defects and RCA | 27 Nov, 22:30–23:30 | 28 Nov, 16:04 | done, late |
| 2.8 mutation, fix PR, blocked PR | 27 Nov, 22:30–23:30 | 28 Nov, 16:13–16:30 | done, late |
| Sections 3–5 | 27 Nov 23:30 – 28 Nov 03:00 | not started | **behind schedule** |

**Slippage.** The overnight block of 27 Nov did not happen, so everything from step 2.3 onwards moved to
28 Nov and started about 19 hours late. Section 2 nevertheless finished on 28 Nov. Sections 3–5 and the
final report remain, with the deadline on 29 Nov at 23:59.

## 2. GQM metrics

**Goal:** judge whether the Requests → Work Orders module is ready to release, and how reliable our
evidence for that judgement is.

| Question | Metric | Value | Source |
|---|---|---|---|
| How defect-prone is the in-scope code? | Defect density = defects ÷ KLOC (in-scope `ncloc`) | 14 ÷ 2.508 = **5.6 per KLOC** | issues #6–#19; SonarQube `ncloc` |
| How much of the specified behaviour has been checked? | Requirements coverage = requirements with ≥ 1 executed test ÷ all | **12 / 12 = 100 %** (unit, API, E2E) | traceability matrix |
| How much of it works? | Requirements passing at every level ÷ all | 8 / 12 = 67 % before the D1 fix; **9 / 12 = 75 %** after it (FR-12 passes) | traceability matrix |
| Do fixes hold? | Reopen rate = reopened ÷ closed issues | **0 / 1** (D1 closed by the fix PR, not reopened) | GitHub issues |
| How strong are the unit tests? | Mutation score on in-scope methods | 61 % (2.3) → **100 %** (2.8) | PIT |
| How much of the logic is exercised? | Statement / branch coverage of in-scope methods | **100 % / 100 %** | JaCoCo, `check-coverage.mjs` |

## 3. Control actions taken this week

1. **CI moved before the unit tests (27 Nov).** Every later step was merged through a gated pull request, so the "fails before / passes after" and "blocked" evidence came from real CI runs.
2. **Environment limits handled once, centrally.**
   - Reset and re-seed before every suite.
   - API calls kept under the rate limit by the client.
   - Browser tests sign in once through the API instead of through the login page.

   These removed all false failures (429 and the work-order limit) seen during the first runs.
3. **Known-defect policy.** Each test that shows a filed defect keeps asserting the expected behaviour and is reported as `todo` or expected failure. CI then stays red only for new regressions, and a fixed defect is noticed automatically.
4. **Schedule recovery.** Sections 3–5 are re-planned for 28 Nov evening and night. Their tools were already proven in the feasibility run (Lighthouse, axe, ZAP, k6). Final report and zip on 29 Nov.

## 4. Risks to the plan

| Risk | Status | Action |
|---|---|---|
| PJ-1 time | **High, materialised (19 h slip)** | Recovery plan above. Section 2 done. Each remaining section has one scripted run. |
| PJ-2 viva knowledge | open | Each member reads their own documents and marks their AI-use rows as reviewed before the demo. |
| PJ-3 environment limits | closed | Handled by control action 2. |
| PJ-4 slow tools | reduced | The CI SonarQube scan is limited to in-scope files (about 3 min). The full scan is local. |
