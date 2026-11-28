# Section 2.2 — Traceability matrix

Owner: Mohsin Khan. Test IDs are filled in as each suite is written, and the coverage line is updated with them.

ID prefixes:
- `UT` = unit test (JUnit);
- `API` = API test;
- `UC` = Playwright use case;
- `SEC` = access-matrix check;
- `PERF` = k6.

| Req | Rule | Risk | Unit | API | E2E / other | Status |
|---|---|---|---|---|---|---|
| FR-01 submit stored pending | — | PR-12 | UT-CRE-01, UT-CRE-05 | createRequest EP/BVA (24), ST-01 | | pass |
| FR-02 title required | — | PR-3 | — | createRequest/editRequest title.01–11 | | fail: D2, W1, W3 (known) |
| FR-03 no create permission → 403 | — | PR-2 | UT-CRE-02 | API-AUTH-01 | | pass |
| FR-04 requester sees own requests only | — | PR-7 | UT-GET-01, UT-GET-02 | API-AUTH-02 | | pass |
| FR-05 edit pending; keep unsent fields | BR-2 | PR-4 | UT-PAT-01..04 | ST-03, ST-06, API-AUTH-03, PATCH-01 | | fail: D3 (known) |
| FR-06 approve creates OPEN work order | BR-2 | PR-1 | UT-APP-01, UT-WO-01..03 | ST-01, approveRequest EP/BVA (17) | | pass |
| FR-07 only SETTINGS or Limited Admin decide | BR-1 | PR-2 | UT-BR1-01..08, UT-CAN-P2, P3 | API-BR1-01..03 (a/b) | | pass |
| FR-08 reject needs a reason | BR-4 | PR-9 | UT-CAN-P1, P6, P7 | rejectRequest reason.01–07 | | pass; W8 (missing reason → 500) |
| FR-09 approved request is final | BR-2 | PR-5 | UT-APP-02, UT-CAN-P5, UT-PAT-02 | ST-04, ST-05, ST-06, REP-01 | | fail: D6 race (known) |
| FR-10 30-work-order limit; request stays pending | BR-3 | PR-6, PR-8 | UT-BR3-01..04, UT-APP-04 | API-BR3-01..03 | | pass |
| FR-11 unknown request → 404 | — | — | UT-APP-03, UT-CAN-P4, UT-PAT-04, UT-GET-03 | path id cases (404 observed) | | pass |
| FR-12 rejected request cannot be approved | BR-2 | PR-1 | UT-APP-12 (records D1) | ST-07 | | fail: D1 (known) |

**Requirements coverage:** 12 / 12 requirements have at least one executed test (100 %) after step 2.5.
8 / 12 pass at every level. 4 have a known failing case, each a filed defect: FR-02 (D2), FR-05 (D3), FR-09 (D6)
and FR-12 (D1).
