# Section 2.3 — White-box unit tests

Owner: Jaweria Abdul Hameed (Area 1).

## 2.3.1 What is tested and how to run it

| Item | Value |
|---|---|
| Test code | `tests/team/unit/src/test/java/com/grash/service/RequestServiceTeamTest.java` (48 tests), `WorkOrderLimitTeamTest.java` (4 tests) |
| Framework | JUnit 5, Mockito, AssertJ (from `spring-boot-starter-test`), JaCoCo 0.8.12 |
| Isolation | All collaborators of `RequestService` are Mockito mocks. Domain objects (`Request`, `User`, `Role`, `Company`) are real, so the permission methods on the model run for real. |
| Scope (EX-2) | `RequestService`: `create` (both W1 overloads), `getById`, `patch`, `approve`, `approveFromWorkflow`, `approveInternal`, `cancel`, `createWorkOrderFromRequest`, and the lambdas inside them. `WorkOrderService.checkUsageBasedLimit`. |
| Run locally | `mvn -f tests/team/pit-mutators/pom.xml install`, then `mvn -f api/pom.xml -Pteam test jacoco:report`, then `node tests/team/ci/check-coverage.mjs` |
| CI | job `tests` in `.github/workflows/quality-gate.yml`. The coverage check fails the job below 100 %. Reports are kept as the artifact `unit-coverage-mutation-reports`. |

The Maven profile `team` (`api/pom.xml`) adds `tests/team/unit` as a test source folder and runs only
`*TeamTest` classes. Upstream's tests are not run. The default upstream build is unchanged.

## 2.3.2 Test design

Test IDs appear in each test's `@DisplayName` and in the traceability matrix.

### Basis paths: `cancel` (from §2.1.3)

| Path | Test | Asserted result |
|---|---|---|
| P1 baseline | UT-CAN-P1 | cancelled, reason stored, no work order |
| P2 Limited Admin | UT-CAN-P2 | cancelled |
| P3 Requester | UT-CAN-P3 | 403 |
| P4 unknown id | UT-CAN-P4 | 404 "Request not found" |
| P5 already approved | UT-CAN-P5 | 406 "Request is already approved"; not cancelled; no reason stored |
| P6 reason null | UT-CAN-P6 | 406 "Please give a reason"; not cancelled |
| P7 reason blank | UT-CAN-P7 | 406 "Please give a reason"; not cancelled |
| P8 no creator | UT-CAN-P8 | cancelled |

### MCC and MC/DC for every compound condition

Java evaluates `||` and `&&` with short circuit, so a combination whose second condition is never
evaluated is written "–". MC/DC pairs are taken from the MCC rows: each pair differs only in the
condition shown, and the outcome changes.

**BR-1: `A || B`** (`RequestService.java:376` approve, `:458` cancel). A = role's view permissions contain SETTINGS; B = role code is LIMITED_ADMIN.

| Row | A | B | Outcome | Approve test | Cancel test | Reachable in the app? |
|---|---|---|---|---|---|---|
| 1 | T | – | allowed | UT-BR1-01 (Admin) | UT-BR1-05 | yes |
| 2 | F | T | allowed | UT-BR1-02 (Limited Admin) | UT-BR1-06 | yes |
| 3 | F | F | 403 | UT-BR1-03 (Requester) | UT-BR1-07 | yes |
| 4 | T | T | allowed | UT-BR1-04 (unit-only role) | UT-BR1-08 | no (Section 1, §1.5) |

MC/DC pairs:
- A: row 1 vs row 3. Admin has B = F, so B is held false.
- B: row 2 vs row 3. A is held false.

**BR-4: `reason == null || reason.trim().isEmpty()`** (`:466`).

| Row | null? | blank? | Outcome | Test |
|---|---|---|---|---|
| 1 | T | – | 406 | UT-CAN-P6 |
| 2 | F | T | 406 | UT-CAN-P7 (`"   "`) |
| 3 | F | F | cancelled | UT-CAN-P1 |

Null and blank together is impossible: a null reason cannot be trimmed. MC/DC pairs:
- null?: row 1 vs row 3.
- blank?: row 2 vs row 3.

**BR-3: `!licensed && hasMoreActiveThan(company, 29)`** (`WorkOrderService.java:193-195`).

| Row | not licensed? | more than 29 incomplete? | Outcome | Test |
|---|---|---|---|---|
| 1 | F | – | allowed | UT-BR3-04 (the repository is never queried) |
| 2 | T | F | allowed | UT-BR3-01 (29 incomplete) |
| 3 | T | T | 403 | UT-BR3-02 (30), UT-BR3-03 (31) |

The repository fake applies the real query's rule (`COUNT(incomplete) > threshold`), so 29, 30 and 31
are a true 3-point boundary around the limit of 30. MC/DC pairs:
- not licensed?: row 1 vs row 3. This is short-circuit (masking) MC/DC: the second condition is not evaluated in row 1.
- more than 29?: row 2 vs row 3.

**Approval asset update: `asset != null && assetStatus != null`** (`:408`).

| Row | asset? | new status? | Asset saved? | Test |
|---|---|---|---|---|
| 1 | F | – | no | UT-APP-01 |
| 2 | T | F | no | UT-APP-09 |
| 3 | T | T | yes, status changed | UT-APP-08 |

**Mail recipients: `isEnabled() && isEmailNotified()`** (lambdas at `:426` and `:489`).

| Row | Condition values | Meaning | Tests |
|---|---|---|---|
| 1 | F, – | disabled Limited Admin | UT-APP-11, UT-CAN-09 |
| 2 | T, F | Limited Admin with e-mail off | same tests |
| 3 | T, T | Limited Admin "Bilal" | same tests |

**In-app notice to other Limited Admins: `code == LIMITED_ADMIN && id != decider`** (lambdas at `:439` and `:502`).

| Row | Condition values | Meaning | Tests |
|---|---|---|---|
| 1 | F, – | Admin or Requester | UT-CAN-10, UT-APP-11 |
| 2 | T, F | the deciding Limited Admin | same tests |
| 3 | T, T | another Limited Admin | same tests |

**BR-2 state guard: `getWorkOrder() != null`** is a single condition:
- in `approve`: UT-APP-02 (true) and UT-APP-01 (false);
- in `approveFromWorkflow`: UT-APP-06 and UT-APP-07;
- in `cancel`: UT-CAN-P5 and UT-CAN-P1;
- in `patch`: UT-PAT-02 and UT-PAT-01.

## 2.3.3 Results

**52 tests, 0 failures.** Coverage from `check-coverage.mjs` on JaCoCo's report:

| Method | Lines | Branches |
|---|---|---|
| `create(Request, Company)` | 16/16 | 8/8 |
| `create(RequestPostDTO, User)` | 5/5 | 2/2 |
| `getById` | 7/7 | 4/4 |
| `patch` | 9/9 | 6/6 |
| `approve` | 3/3 | 4/4 |
| `approveFromWorkflow` | 1/1 | 0/0 |
| `approveInternal` | 47/47 | 16/16 |
| `cancel` | 43/43 | 14/14 |
| `createWorkOrderFromRequest` | 9/9 | 4/4 |
| `WorkOrderService.checkUsageBasedLimit` | 5/5 | 4/4 |
| 12 lambdas inside `approveInternal` and `cancel` | 13/13 | 16/16 |

**100 % statement and branch coverage of every in-scope method. No uncovered code needs justifying.**

The public-portal overload `create(Request, Company, RequestPortal)` is out of functional scope, but it is
covered as well (UT-CRE-06, UT-CRE-07). It shares code with W1, so leaving it uncovered would dilute the
mutation score.

**Coverage is not test strength.** PIT on the same suite, with its defaults plus our two custom
operators and restricted to the in-scope methods, gives:
- 113 mutants;
- 69 killed (**61 %**);
- 44 survived;
- 0 with no coverage.

Every line runs, but many tests only check the returned outcome. They do not check side effects: what
is saved, who is notified and mailed, which workflows run. The 44 survivors are analysed and killed in
step 2.8.

Our custom operators already show their value:
- `DROP_ROLE_ALTERNATIVE` is **killed** at the BR-1 checks (lines 376 and 458). Upstream's own tests left these mutants alive (§2.1). It survives in 4 notification lambdas.
- `IGNORE_APPROVAL_STATE` is **killed** at every BR-2 guard (lines 365, 391, 402 and 463).

## 2.3.4 Notes

- **A test-design error caught on the first run.** The test Limited Admin role was given permission to create requests, so UT-CRE-02 failed. The real role (`Helper.java:255`) does not have that permission. The fixture now mirrors the real role exactly.
- **Defect D1 is visible in the suite.** UT-APP-12 records the baseline behaviour: a cancelled request is approved and a work order is created. It is turned into a failing test and fixed through a pull request in step 2.8.
