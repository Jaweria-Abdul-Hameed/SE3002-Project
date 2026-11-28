# Section 2.5 — API and integration tests

Owner: Mohsin Khan (Area 2).

## 2.5.1 How the tests run

| Item | Value |
|---|---|
| Code | `tests/team/api/tests/` (Node.js built-in test runner): `ep-bva.test.mjs`, `rules-state.test.mjs`, `br3-boundary.test.mjs` |
| Target | The whole system started from this commit (docker compose), through nginx at `http://localhost:3000/api` |
| Data | EP and BVA inputs come only from `generated/test-data.json` (Section 2.4). Users come from `tests/team/env/seed.mjs`. |
| Isolation | Every suite resets and re-seeds the system first (`resetEnvironment()`, test plan §2.2.5) |
| Rate limits | Each user is kept under 100 calls a minute by the client, and tokens are reused, so a 429 is never a false failure |
| Run | `cd tests/team/api && npm ci && npm test`, then `node report/api-coverage.mjs` |
| CI | job `system-tests` in `.github/workflows/quality-gate.yml`. Results are kept as the artifact `api-test-results`. |

**Known defects.** A case where the baseline differs from our specification is a reported defect or
weakness (`tests/lib/known-defects.mjs`, GitHub issues in Section 2.7). The test still asserts the
**expected** behaviour, but it is reported as `todo` instead of failing the run. CI therefore still fails on
any *new* regression. When a defect is fixed, its test starts passing and the entry is removed.

## 2.5.2 What is covered

| Technique / requirement of the brief | Tests |
|---|---|
| EP and 3-point BVA on every input, from generated data, one invalid value per test | `ep-bva` (90 cases over 5 operations) |
| Rule rejections | BR-1: `API-BR1-01..03` (approve and reject × 3 roles); BR-3: `API-BR3-01..03`; BR-4: generated reason cases |
| Decision table (BR-1) | `API-BR1-01a/b` A=T,B=F; `02a/b` A=F,B=T; `03a/b` A=F,B=F. A=T,B=T is unreachable (Section 1 §1.5). |
| State transitions: every allowed transition, and one or more disallowed transitions from each state | Allowed: Pending→Approved `ST-01`, Pending→Rejected `ST-02`, Pending→Pending (edit) `ST-03`. Disallowed from Approved: `ST-04` approve, `ST-05` reject, `ST-06` edit. Disallowed from Rejected: `ST-07` approve, `ST-08` reject, `ST-09` edit. |
| Repeated requests (no duplicates) | `ST-04` (sequential), `REP-01` (two approvals at the same moment, 5 tries), `REP-02` (reject twice) |
| Read back shared records after success and after rejection | Every test reads the request (and the work orders) back after the call |
| BR-3 boundary through the API | 29 incomplete → allowed; 30 → refused 403 and the request stays pending; one work order completed → allowed again |
| Authorisation | `API-AUTH-01` Limited Admin submits → 403; `02` another requester reads → 403; `03` another requester edits → 403 |

## 2.5.3 Results (local run, 2026-11-28)

**115 tests: 69 pass, 0 fail, 46 known defects (`todo`).**

### Defects and endpoint weaknesses found

| ID | Finding | Evidence (test cases) | Expected | Baseline |
|---|---|---|---|---|
| **D1** | A rejected request can still be approved | ST-07 | 406 | 200, a work order is created |
| **D2** | Empty or whitespace-only title accepted | create and edit `title.03`, `title.04` | 400 | 200, stored as `""` |
| **D3** | `PATCH` replaces fields that were not sent | PATCH-01 | other fields kept | priority → NONE, description → null; a body without a title gives 500 |
| **D4** | A rejected request can be rejected again | ST-08, REP-02 | 406 | 200, first reason overwritten |
| **D5** | A rejected request can still be edited | ST-09 | 406 | 200 |
| **D6** | Two approvals at the same moment can create **two work orders** for one request | REP-01 (intermittent: 1 of 1, then 1 of 5 tries) | one 200, one 406, one work order | both 200; one work order is orphaned |
| W1 | Title over 255 characters | `title.09` | 400 | **500** "value too long for type character varying(255)" |
| W2 | Description over 10,000 characters | `description.06` | 400 | 200 (the spec's maxLength is not enforced) |
| W3 | JSON number where a string is required | `title.02`, `description.02` | 400 | 200 (coerced to text) |
| W4 | Unknown enum value (priority, assetStatus) | `priority.05–07`, `assetStatus.08–10` | 400 | **500** "JSON parse error" |
| W5 | Id 0 or negative | `id.01`, `id.04` | 400 | 404 |
| W6 | Non-numeric or decimal id | `id.05`, `id.06` | 400 | **500** "Failed to convert value" |
| W7 | Id missing from the approve or reject path | approve and reject `id.07` | 404 | **500** |
| W8 | Rejection `reason` missing | `reason.06` | 400 | **500** "Required request parameter 'reason' … is not present" |

**Most serious: D6 and D1.** D6 breaks the "no duplicates" requirement under concurrent use. The guard at
`RequestService.java:391` checks `getWorkOrder() != null` without a lock, so two simultaneous approvals both
pass it. W4, W6, W7 and W8 share one root cause: client errors that reach the global exception handler are
returned as 500.

## 2.5.4 API coverage

From `report/api-coverage.mjs` over all recorded calls:

| Criterion | Covered |
|---|---|
| Paths | 4 / 4 (100 %) |
| Operations | 5 / 5 (100 %) |
| Parameters and body properties | 12 / 12 (100 %) |
| Parameter values (every enum member, every generated class and boundary) | 90 / 90 (100 %) |
| Request content types (`application/json`) | 3 / 3 (100 %) |
| Documented status codes observed | 18 / 22 (81.8 %) |

**The 4 documented codes never observed are all `400`,** on get, edit, approve and reject. They are not
missing tests: the generated invalid cases target them, but the baseline answers 404 (W5) or 500 (W4, W6)
instead. Every test input the spec calls for is sent, so input-side coverage is 100 %. Output-side
coverage shows exactly the weaknesses above. `500` is observed on every operation but is documented nowhere.
