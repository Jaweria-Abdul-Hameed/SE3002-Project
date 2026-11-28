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
| FR-01 submit stored pending | — | PR-12 | UT-CRE-01, UT-CRE-05 | | | unit pass |
| FR-02 title required | — | PR-3 | — | | | not run |
| FR-03 no create permission → 403 | — | PR-2 | UT-CRE-02 | | | unit pass |
| FR-04 requester sees own requests only | — | PR-7 | UT-GET-01, UT-GET-02 | | | unit pass |
| FR-05 edit pending; keep unsent fields | BR-2 | PR-4 | UT-PAT-01..04 | | | unit pass |
| FR-06 approve creates OPEN work order | BR-2 | PR-1 | UT-APP-01, UT-WO-01..03 | | | unit pass |
| FR-07 only SETTINGS or Limited Admin decide | BR-1 | PR-2 | UT-BR1-01..08, UT-CAN-P2, P3 | | | unit pass |
| FR-08 reject needs a reason | BR-4 | PR-9 | UT-CAN-P1, P6, P7 | | | unit pass |
| FR-09 approved request is final | BR-2 | PR-5 | UT-APP-02, UT-CAN-P5, UT-PAT-02 | | | unit pass |
| FR-10 30-work-order limit; request stays pending | BR-3 | PR-6, PR-8 | UT-BR3-01..04, UT-APP-04 | | | unit pass |
| FR-11 unknown request → 404 | — | — | UT-APP-03, UT-CAN-P4, UT-PAT-04, UT-GET-03 | | | unit pass |
| FR-12 rejected request cannot be approved | BR-2 | PR-1 | UT-APP-12 (records D1) | | | executed; shows D1 (expected behaviour not met) |

**Requirements coverage:** 11 / 12 requirements have at least one executed test (92 %) after step 2.3
(unit level). FR-02 is a validation rule on the controller (`@NotNull`), so it is covered at API level in step 2.5.
FR-12 is executed, and its test documents defect D1 until the fix in step 2.8.
