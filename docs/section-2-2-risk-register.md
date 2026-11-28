# Section 2.2 — Risk register

Owner: Muhammad Aun.

Likelihood (L) and impact (I) are scored 1–5. Risk score = L × I on a 5 × 5 matrix.

| Level | Score | Test depth |
|---|---|---|
| **High** | 15–25 | Two or more techniques at two or more test levels. Mutation focus. Exit criteria tied to it. |
| **Medium** | 8–14 | One systematic technique at the most suitable level, automated. |
| **Low** | 1–7 | Covered by the smoke and regression suites only. |

Where a risk was already observed on the baseline (Section 1), its likelihood is 5.

## Product risks

| ID | Risk | Evidence | L | I | Score | Level | Technique and depth |
|---|---|---|---|---|---|---|---|
| PR-1 | A rejected request can still be approved, which schedules maintenance work that was refused | D1, FR-12: reproduced (200, work order created) | 5 | 4 | **20** | High | State transitions (every state and transition) at unit and API level. Playwright check of the UI state. Defect report with RCA. |
| PR-2 | A user without permission approves or rejects requests | BR-1, `RequestService.java:376, 458` | 2 | 5 | **10** | Medium | Decision table and MC/DC at unit level. API role checks. Playwright access matrix. Custom mutant `DROP_ROLE_ALTERNATIVE`. |
| PR-3 | A request with an empty or blank title is accepted | D2, FR-02: `""` and `"   "` stored | 5 | 3 | **15** | High | Equivalence partitions and 3-point boundaries on `title` from generated data (API). UI validation check. |
| PR-4 | Editing a request erases fields that were not sent (priority, description) | D3, FR-05: HIGH→NONE observed | 5 | 3 | **15** | High | API tests that read back every field after `PATCH`. Defect report with RCA. |
| PR-5 | An approved request is approved or rejected again, creating duplicate work orders | BR-2, FR-09 | 2 | 4 | **8** | Medium | Repeated-request API tests (no duplicates; read back the work-order count). Custom mutant `IGNORE_APPROVAL_STATE`. |
| PR-6 | The 30-work-order limit is off by one (blocks the 30th or allows the 31st) | BR-3, FR-10 | 2 | 4 | **8** | Medium | 3-point boundaries at 29, 30 and 31 (API), with reset before the suite. |
| PR-7 | A requester reads another requester's request | FR-04, `Request.java:74` | 2 | 4 | **8** | Medium | Access matrix (Playwright) and API negative tests. |
| PR-8 | A failed approval leaves partial state (a work order without a linked request, or the reverse) | FR-10 read-back; `@Transactional` on approve | 2 | 4 | **8** | Medium | Failure-and-recovery test with a test double (Section 5). Read back after a refused approval. |
| PR-9 | Client mistakes return 500 instead of 4xx (missing `reason`, 6th paid user) | Section 1, A-4 | 5 | 2 | **10** | Medium | API negative tests. Reported as endpoint weaknesses. |
| PR-10 | Known-vulnerable third-party packages | npm audit (frontend): 3 critical, 48 high | 4 | 4 | **16** | High | Dependency audit (OWASP Dependency-Check for the API, npm audit for the frontend). Findings with component, impact and fix. |
| PR-11 | The request and work-order screens have accessibility barriers | axe: unnamed buttons, contrast failures | 4 | 3 | **12** | Medium | Lighthouse and axe on the key screens. Fix one screen and compare before and after. Keyboard-navigation test. |
| PR-12 | Submitting a request is slow or fails under concurrent use | k6 feasibility: p95 96 ms at 5 users | 1 | 3 | **3** | Low | k6 at 1 and 5 users, two runs each (Section 5). |

## Project risks

| ID | Risk | L | I | Score | Level | Mitigation |
|---|---|---|---|---|---|---|
| PJ-1 | Not enough time: everything is due by 2026-11-29 23:59 | 4 | 5 | **20** | High | CI built early. Scripted setup, seed and reset. Work ordered by risk level. Daily progress check against the schedule. |
| PJ-2 | A member cannot explain AI-assisted work in the viva (explain-or-zero rule) | 3 | 5 | **15** | High | Each deliverable comes with notes for its owner. "Member review" column in the AI-use record. Rehearse viva questions. |
| PJ-3 | Environment limits cause false failures (rate limits, free-tier caps) | 4 | 3 | **12** | Medium | Reset before each suite. One account per k6 user. Reuse tokens. |
| PJ-4 | Slow tools delay feedback (a full SonarQube scan takes about 30 min) | 3 | 2 | **6** | Low | The CI scan is limited to in-scope files. Full scans are run locally. |

## Heat map

| L \ I | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | PR-9 | PR-3, PR-4 | PR-1 | |
| **4** | | | PR-11, PJ-3 | PR-10 | PJ-1 |
| **3** | | PJ-4 | | | PJ-2 |
| **2** | | | | PR-5, PR-6, PR-7, PR-8 | PR-2 |
| **1** | | | PR-12 | | |

The register is updated when a test result or defect changes a likelihood. Residual risk per risk is
reported in the test completion report.
