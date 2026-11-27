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
| FR-01 submit stored pending | — | PR-12 | | | | not run |
| FR-02 title required | — | PR-3 | | | | not run |
| FR-03 no create permission → 403 | — | PR-2 | | | | not run |
| FR-04 requester sees own requests only | — | PR-7 | | | | not run |
| FR-05 edit pending; keep unsent fields | BR-2 | PR-4 | | | | not run |
| FR-06 approve creates OPEN work order | BR-2 | PR-1 | | | | not run |
| FR-07 only SETTINGS or Limited Admin decide | BR-1 | PR-2 | | | | not run |
| FR-08 reject needs a reason | BR-4 | PR-9 | | | | not run |
| FR-09 approved request is final | BR-2 | PR-5 | | | | not run |
| FR-10 30-work-order limit; request stays pending | BR-3 | PR-6, PR-8 | | | | not run |
| FR-11 unknown request → 404 | — | — | | | | not run |
| FR-12 rejected request cannot be approved | BR-2 | PR-1 | | | | not run |

**Requirements coverage:** 0 / 12 requirements have at least one passing or failing executed test
(0 %). Updated as suites land.
