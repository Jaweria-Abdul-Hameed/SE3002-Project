# Section 2.2 — Test plan

Owner: Jaweria Abdul Hameed. This is a living document. Changes are recorded in §2.2.10.

## 2.2.1 Scope

Defined in `docs/section-1-scope-and-test-basis.md`:
- workflows W1 (submit a request) and W2 (approve or reject it);
- requirements FR-01 to FR-12;
- rules BR-1 to BR-4;
- the in-scope files in §1.7.

Everything listed there as out of scope is not tested.

## 2.2.2 Approach by risk level

Risk levels come from `docs/section-2-2-risk-register.md`. The level sets the technique and depth.

| Level | Risks | Approach |
|---|---|---|
| High | PR-1, PR-3, PR-4, PR-10 | Two or more techniques at two or more levels. Unit and API tests plus a Playwright check. Mutation analysis on the related code. A defect report with root-cause analysis. |
| Medium | PR-2, PR-5 to PR-9, PR-11 | One systematic technique (decision table, state transition, BVA or EP) at the most suitable level, automated. |
| Low | PR-12 | Smoke and regression only, plus the performance runs the brief requires. |

**Test levels and techniques**

| Level | Tool | Technique | Target |
|---|---|---|---|
| Unit | JUnit 5, Mockito, JaCoCo | Basis paths, MCC, MC/DC; decision table (BR-1); state transitions (BR-2) | 100 % statement and branch coverage of the in-scope `RequestService` methods |
| Unit (mutation) | PIT with our 2 custom operators | Mutation analysis | Score threshold in §2.2.6 |
| API / integration | Generated data (OpenAPI → EP and 3-point BVA), Node test runner | EP, BVA, decision table, state transitions, repeated requests, read-back of shared records | Every input of the in-scope endpoints |
| Browser end to end | Playwright (Chromium) | Use-case testing: 2 use cases per member, each with 2 or more alternative and 2 or more exception flows | Result shown and postconditions |
| Usability and accessibility | Lighthouse, axe-core | Automated checks, keyboard navigation | Key screens of both workflows |
| Security | Playwright, OWASP ZAP (passive), dependency audit | Access matrix, passive scan, audit | Both workflows |
| Performance and recovery | k6, test double | Load at 1 and 5 users; failure and recovery | W1 submit; W2 approve |

## 2.2.3 Roles

| Member | Area | Test-management lead |
|---|---|---|
| Jaweria Abdul Hameed | (1) SonarQube, white-box unit tests, mutation, CI gate | test plan, estimation, exit criteria |
| Mohsin Khan | (2) OpenAPI, data generator, API tests | defects and RCA, traceability, weekly metrics |
| Muhammad Aun | (3) use cases, usability and accessibility, security, performance | risk register |

Every member writes and automates 2 use cases.

## 2.2.4 Environment

| Item | Value |
|---|---|
| System under test | Atlas CMMS at baseline `a3c7ce38`, built from source (`docker-compose.source.yml`) |
| Local | Windows 11, Docker Desktop, Node.js. Java and Maven run in the `maven:3.9-eclipse-temurin-17` image. |
| CI | GitHub Actions `ubuntu-latest`. Workflow `.github/workflows/quality-gate.yml`. SonarQube Community as a service container. |
| Static analysis | SonarQube Community (local port 9100; CI service container) |

## 2.2.5 Test data

- **Fixed users.** `tests/team/env/seed.mjs` creates one company with an Admin, a Limited Admin and 2 Requesters. All data is synthetic, on `*.se3002.test` addresses.
- **Generated inputs.** API inputs come from the generator built in step 2.4 (equivalence classes and 3-point boundary values read from the OpenAPI spec).
- **Reset.** `node tests/team/env/reset.mjs` runs before every suite that changes data. This keeps the starting data identical, which BR-3 and the performance runs depend on.

## 2.2.6 Entry, exit, suspension and resumption criteria

**Entry**, for any suite:
- E1. The environment starts from a reset and the seed succeeds.
- E2. The build is from baseline `a3c7ce38` plus only our test changes.
- E3. CI on `main` is green.

**Exit criteria.** These are measurable, and the first two are tied to the highest risks.

| ID | Criterion | Type | Risk | Target |
|---|---|---|---|---|
| EX-1 | Every BR-2 state-transition case (each allowed transition, and one disallowed transition from each state) is executed. Every failure is a logged, triaged defect. | Functional | PR-1 (20) | 100 % executed; 0 failures without a triaged issue |
| EX-2 | Statement and branch coverage of the in-scope `RequestService` methods (`approve`, `approveInternal`, `cancel`, `patch`, `create`, `getById`, `createWorkOrderFromRequest`) | Functional (white-box) | PR-1, PR-2, PR-5 | 100 % statement and 100 % branch; any exception justified |
| EX-3 | Mutation score of `RequestService` (PIT defaults plus our 2 custom operators), surviving mutants analysed | Functional (test strength) | PR-2, PR-5 | ≥ 80 %, enforced in CI |
| EX-4 | W1 submit under 5 concurrent users | Performance | PR-12 | p95 ≤ 500 ms; unexpected failures < 1 % |
| EX-5 | Access-matrix checks match the expected result | Security | PR-2, PR-7 | 100 % |

The **three release criteria** reported as actual vs target in the completion report are **EX-1, EX-2
and EX-4**.

**Suspension** (stop the affected suite):
- S1. The backend does not start, or the seed fails.
- S2. More than 20 % of a suite fails for environment reasons (429 rate limit, free-tier cap, container down).
- S3. CI is unavailable, or a change outside our scope breaks the build.

**Resumption:**
- R1. Reset and seed succeed, and the smoke check (`seed.mjs`, then submit and approve one request) passes.
- R2. The cause of the suspension is recorded in the weekly report.

## 2.2.7 Schedule

| When (PKT) | Step | Owner |
|---|---|---|
| 27 Nov, 17:00–18:00 | 2.1 SonarQube and complexity; CI skeleton | Jaweria |
| 27 Nov, 18:00–18:30 | 2.2 plan, risks, exit criteria, estimation, traceability | Jaweria, Aun, Mohsin |
| 27 Nov, 18:30–20:00 | 2.3 unit tests (MCC, MC/DC, coverage); PIT in CI | Jaweria |
| 27 Nov, 20:00–21:30 | 2.4 OpenAPI and generator; 2.5 API tests | Mohsin |
| 27 Nov, 21:30–22:30 | 2.6 use cases and Playwright | all |
| 27 Nov, 22:30–23:30 | 2.7 defects and RCA; 2.8 mutation analysis, fix PR, blocked PR | Mohsin, Jaweria |
| 27 Nov 23:30 – 28 Nov 00:30 | Section 3 usability and accessibility | Aun |
| 28 Nov, 00:30–01:30 | Section 4 security | Aun |
| 28 Nov, 01:30–03:00 | Section 5 performance and recovery | Aun |
| 29 Nov | Completion report, final PDF, zip, viva preparation | all |

## 2.2.8 Estimation (three-point, hours)

E = (O + 4M + P) / 6. Actual effort is filled in from commit and session times at the end.

| Area | Optimistic | Most likely | Pessimistic | Estimate E | Actual |
|---|---|---|---|---|---|
| (1) SonarQube, unit, mutation, CI | 6 | 9 | 14 | 9.3 | _end_ |
| (2) OpenAPI, generator, API tests | 3 | 5 | 8 | 5.2 | _end_ |
| (3) Use cases, usability, security, performance | 5 | 7 | 11 | 7.3 | _end_ |
| Shared management (plan, risks, defects, reports) | 3 | 4 | 7 | 4.3 | _end_ |
| **Total** | 17 | 25 | 40 | **26.2** | |

## 2.2.9 Related documents

- Risk register: `docs/section-2-2-risk-register.md`.
- Traceability: `docs/section-2-2-traceability.md`.
- Defects: GitHub Issues with severity, priority, status and triage labels (step 2.7).

## 2.2.10 Change log

| Date | Change |
|---|---|
| 2026-11-27 | First version. The CI gate was moved before the unit tests so that every later step is merged through a gated pull request. |
| 2026-11-28 | Schedule re-planned: steps 2.3–2.8 done on 28 Nov (about 19 h late); Sections 3–5 moved to the evening and night of 28 Nov (weekly report §1). |
| 2026-11-28 | Approach additions: reset before every suite; client-side rate limiting; browser tests sign in once through the API; known-defect policy (`todo` and expected failure). |
| 2026-11-28 | Exit-criteria status: EX-2 met (100 % / 100 %); EX-3 met (mutation score 100 % ≥ 80 %); EX-1 not yet met (D4 and D5 still fail from Rejected; D1 fixed). |
