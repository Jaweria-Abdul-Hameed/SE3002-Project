# Section 2.8 — Mutation testing and the CI quality gate

Owner: Jaweria Abdul Hameed (Area 1).

## 2.8.1 Mutation set-up

| Item | Value |
|---|---|
| Tool | PIT 1.30.2 with `pitest-junit5-plugin` 1.2.3 (`api/pom.xml`, profile `team`) |
| Target | `com.grash.service.RequestService`, restricted to the in-scope methods (out-of-scope methods are listed in `excludedMethods`) |
| Tests | our `*TeamTest` classes only |
| Operators | PIT `DEFAULTS` plus our two custom operators (`tests/team/pit-mutators`): |
| | • `DROP_ROLE_ALTERNATIVE` replaces `RoleCode.equals(…)` with `false`. It removes the Limited Admin alternative of BR-1. |
| | • `IGNORE_APPROVAL_STATE` treats `Request.getWorkOrder()` as `null` in a null check. It disables the BR-2 "already approved" guard. |
| Run | `mvn -f api/pom.xml -Pteam org.pitest:pitest-maven:mutationCoverage` (CI job `tests`) |

## 2.8.2 Scores

| Run | Suite | Mutants | Killed | Survived | No coverage | Score |
|---|---|---|---|---|---|---|
| Step 2.3 | outcome-only assertions | 113 | 69 | 44 | 0 | **61 %** |
| Step 2.8 | side effects asserted; 9 new checks | 113 | 113 | 0 | 0 | **100 %** |

Statement and branch coverage was **100 % in both runs**. The difference is entirely test strength.

**Custom operators:**

| Operator | Mutants | Killed in 2.3 | Survived in 2.3 | Killed in 2.8 |
|---|---|---|---|---|
| `DROP_ROLE_ALTERNATIVE` | 6 | 2 (BR-1 checks, lines 376 and 458) | 4 (notification filters, lines 425, 439, 488, 502) | all 6 |
| `IGNORE_APPROVAL_STATE` | 4 | 4 (lines 365, 391, 402, 463) | 0 | all 4 |

Upstream's own tests left `DROP_ROLE_ALTERNATIVE` alive at lines 376 and 458 (Section 2.1). Our BR-1 MC/DC
tests kill it.

## 2.8.3 Analysis of the 44 surviving mutants

Each survivor is classified as:
- **weak assertion:** a test runs the mutated code but does not check its effect;
- **missing test:** no test was designed to observe that behaviour at all;
- **equivalent:** no test could tell the mutant apart from the original.

| # | Line | Method | Mutation | Class | Killed by (2.8) |
|---|---|---|---|---|---|
| 1 | 104 | create | `!customFields.isEmpty()` → false | weak assertion | UT-CRE-03 verifies `setCustomFields` |
| 2 | 105 | create | removed `setRequestCustomFields` | weak assertion | UT-CRE-03 |
| 3 | 112 | create | removed `Sanitizer.sanitizeRequest` | missing test | UT-CRE-01: `"  <b>Leaking</b> tap  "` stored as `"Leaking tap"` |
| 4 | 115 | create | removed `em.refresh` | missing test | UT-CRE-01 verifies `refresh` |
| 5 | 119 | create | removed `dispatchWebhook` (NEW_REQUEST) | missing test | UT-CRE-01 verifies the webhook and its payload |
| 6 | 131 | create (portal) | removed `setCompany` | missing test | UT-CRE-06: request belongs to the portal's company |
| 7 | 132 | create (portal) | removed `sanitizeRequest` | missing test | UT-CRE-06: `<i>` removed |
| 8 | 143 | create (portal) | removed `em.refresh` | missing test | UT-CRE-06 |
| 9 | 147 | create (portal) | removed `dispatchWebhook` | missing test | UT-CRE-06 |
| 10 | 320 | create (W1) | removed `onRequestCreation` | weak assertion | UT-CRE-01 verifies the REQUEST_CREATED workflows run |
| 11 | 420 | approveInternal | removed `dispatchWebhook` (status change) | missing test | UT-APP-01: payload `newStatus = APPROVED` |
| 12 | 425 | approve mail filter | `DROP_ROLE_ALTERNATIVE` (LA code check → false) | weak assertion | UT-APP-01 checks the exact mail recipients |
| 13 | 425 | approve mail filter | lambda returns false | weak assertion | UT-APP-01 |
| 14 | 425 | approve mail filter | lambda returns true | weak assertion | UT-APP-01 (Admin would also be mailed) |
| 15 | 426 | approve mail filter | `isEnabled()` check removed | weak assertion | UT-APP-11 (disabled Limited Admin not mailed) |
| 16 | 426 | approve mail filter | `isEmailNotified()` check removed | weak assertion | UT-APP-11 (e-mail-off Limited Admin not mailed) |
| 17 | 426 | approve mail filter | lambda returns true | weak assertion | UT-APP-11 |
| 18 | 429 | approveInternal | `createdBy != null` → false | weak assertion | UT-APP-01 (requester mailed) and UT-APP-10 |
| 19 | 433 | approveInternal | removed requester notification | weak assertion | UT-APP-11 (two notification calls captured) |
| 20 | 439 | approveInternal | removed Limited-Admin notification | weak assertion | UT-APP-11 |
| 21 | 439 | approve notice filter | `DROP_ROLE_ALTERNATIVE` | weak assertion | UT-APP-11 (exact ids 5 and 6) |
| 22 | 439 | approve notice filter | LA check removed | weak assertion | UT-APP-11 |
| 23 | 439 | approve notice filter | "not the decider" check removed | weak assertion | UT-APP-11 (the deciding LA, id 2, is excluded) |
| 24 | 439 | approve notice filter | lambda returns true | weak assertion | UT-APP-11 |
| 25 | 439 | approve notice map | `Notification` → null | weak assertion | UT-APP-11 (reads each notification's user) |
| 26 | 446 | approveInternal | removed mail send | weak assertion | UT-APP-01 |
| 27 | 473 | cancel | removed `workflows.forEach` | weak assertion | UT-CAN-11 verifies `runRequest` |
| 28 | 473 | cancel workflow lambda | removed `runRequest` | weak assertion | UT-CAN-11 |
| 29 | 482 | cancel | removed `dispatchWebhook` | missing test | UT-CAN-P1: payload `newStatus = CANCELLED` |
| 30 | 488 | reject mail filter | `DROP_ROLE_ALTERNATIVE` | weak assertion | UT-CAN-P1 (exact recipients) |
| 31 | 488 | reject mail filter | lambda returns false | weak assertion | UT-CAN-P1 |
| 32 | 488 | reject mail filter | lambda returns true | weak assertion | UT-CAN-P1 |
| 33 | 489 | reject mail filter | `isEnabled()` check removed | weak assertion | UT-CAN-09 |
| 34 | 489 | reject mail filter | `isEmailNotified()` check removed | weak assertion | UT-CAN-09 |
| 35 | 489 | reject mail filter | lambda returns true | weak assertion | UT-CAN-09 |
| 36 | 491 | cancel | `createdBy != null` → false | weak assertion | UT-CAN-P1 (requester mailed) and UT-CAN-P8 |
| 37 | 496 | cancel | removed requester notification | weak assertion | UT-CAN-10 (two notification calls) |
| 38 | 502 | cancel | removed Limited-Admin notification | weak assertion | UT-CAN-10 |
| 39 | 502 | reject notice filter | `DROP_ROLE_ALTERNATIVE` | weak assertion | UT-CAN-10 (exactly id 7) |
| 40 | 502 | reject notice filter | LA check removed | weak assertion | UT-CAN-10 |
| 41 | 502 | reject notice filter | "not the decider" check removed | weak assertion | UT-CAN-10 |
| 42 | 502 | reject notice filter | lambda returns true | weak assertion | UT-CAN-10 |
| 43 | 502 | reject notice map | `Notification` → null | weak assertion | UT-CAN-10 |
| 44 | 509 | cancel | removed mail send | weak assertion | UT-CAN-P1 |

**Totals:** 35 weak assertions, 9 missing tests, **0 equivalent**. All 44 were killable and all are killed.

**Equivalent-mutant check.** The likeliest candidates were examined and none is equivalent:
- #14 and #24: a filter that always returns true would add the Admin and the Requester to the mail or notice list, which can be observed.
- #25 and #43: a `null` notification would put a `null` into the list given to `createMultiple`, which can be observed.

**Lesson.** The outcome-only suite already had 100 % coverage. Three quarters of the survivors were in
side effects the tests ran but never checked: who is mailed or notified, which workflows run, which
webhooks fire. That is exactly the gap mutation testing exposes and coverage does not.

## 2.8.4 Quality gate (`.github/workflows/quality-gate.yml`)

The gate runs on every pull request to `main` and on every push to `main`. Branch protection on `main`
requires a pull request with the `tests` and `sonarqube` checks passing, and it applies to admins too.

| Job | What it enforces | Threshold | Justification |
|---|---|---|---|
| `tests` | Our 52 unit tests | all pass | — |
| `tests` | EX-2: line and branch coverage of every in-scope method (`check-coverage.mjs`) | **100 %** | The brief requires 100 % of server-side business logic. The scope is fixed in §1.7, so 100 % is achievable and was reached. |
| `tests` | EX-3: PIT mutation score on in-scope methods (`mutationThreshold`) | **≥ 80 %** | The current score is 100 %. 80 % leaves room for future equivalent mutants (which cannot be killed) and is the usual industrial target. A drop below 80 % means assertions have weakened. |
| `sonarqube` | Our quality gate on the in-scope files, with our coverage imported | Security rating ≤ D, Reliability rating ≤ C | No regression from the measured in-scope baseline (RequestController D: 9 mass-assignment findings; services C). Each CI run uses a fresh SonarQube container, so "new code" conditions never apply and overall conditions are used. |
| `system-tests` | API suites (EP/BVA, rules, states, BR-3) and 30 Playwright flows against the whole system | all pass; known defects reported as `todo` / expected failure | Every new regression fails. A known defect fails only if its behaviour changes, which forces an update to `known-defects.mjs`. |
| `deploy` | Publishes the API image to GHCR | runs only on `main`, only after `tests`, `sonarqube` and `system-tests` pass | "Block merge and deployment on failures" |

**No escape hatches:** there is no `continue-on-error` and no `|| true` anywhere in the workflow.
`if: always()` is used only on the steps that upload reports, so the evidence is kept when a job fails.
It never turns a failure into a pass.

## 2.8.5 Documented fix through a pull request

**Pull request #23, "Fix D1 (#6): a rejected request can no longer be approved."** D1 was chosen because it
belongs to the highest product risk (PR-1, score 20).

| Commit | Change | CI run | Result |
|---|---|---|---|
| `347ca33c` | **Test first.** UT-APP-12 now expects 406 "Request is cancelled" and no work order. API-ST-07 is no longer a known defect. | [SE3002-Project run 46138875938](https://github.com/Jaweria-Abdul-Hameed/SE3002-Project/actions/runs/46138875938) | **Failed (before):** `tests` fails on UT-APP-12 (52 run, 1 failure); `system-tests` fails on API-ST-07 ("expected: 406") |
| `f393ed7d` | **Fix.** `RequestService.approveInternal` throws 406 "Request is cancelled" when `isCancelled()`, before any workflow or work-order creation. | [run 46139692562](https://github.com/Jaweria-Abdul-Hameed/SE3002-Project/actions/runs/46139692562) | **Passed (after):** 52 tests; PIT 114/114 (100 %, the new guard adds 1 mutant); API-ST-07 passes; 30 Playwright flows pass; SonarQube gate passed |

After the merge, issue #6 is closed and labelled `status:fixed` and `status:verified`. FR-12 now passes, so
requirements passing go from 8/12 to 9/12. The fix's own coverage: `approveInternal` 49/49 lines and 18/18
branches.

## 2.8.6 A pull request the pipeline blocked

**Pull request #24, "Simplify the approval permission check".** The change looks harmless: `approve` keeps
only the SETTINGS condition of BR-1 and drops `|| LIMITED_ADMIN`. In effect it removes the Limited Admin's
right to approve, which is the real-world version of our `DROP_ROLE_ALTERNATIVE` mutant.

| Gate | Result in [run 46138902709](https://github.com/Jaweria-Abdul-Hameed/SE3002-Project/actions/runs/46138902709) |
|---|---|
| `tests` | **Failed.** `approveLimitedAdmin` (UT-BR1-02) and `approvalRecipients` (UT-APP-11): CustomException "Forbidden". 52 run, 2 errors. |
| `system-tests` | **Failed.** API-BR1-02a (approve as Limited Admin, expected 200); the BR-3 setup ("approval 2 failed: 403", the Limited Admin's approvals) |
| `sonarqube`, `deploy` | Not run (they need `tests` first) |
| Branch protection | Merge state **BLOCKED** |

The pull request was not merged. It is kept as evidence and then closed.
