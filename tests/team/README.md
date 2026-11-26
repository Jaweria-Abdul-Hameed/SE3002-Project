# SE3002 team testing workspace

All of our own test code lives under `tests/team/`. Upstream tests under `api/src/test/`
are not ours and are excluded from our coverage and mutation gates.

## Team

| Member | GitHub | Area | Shared test-management lead |
|---|---|---|---|
| Jaweria Abdul Hameed | Jaweria-Abdul-Hameed | (1) Static analysis, white-box testing, mutation testing, CI quality gate | Test plan, estimation, exit and release criteria |
| Mohsin Khan | mohsinkhandevs | (2) API testing and automated test-data generation | Defects and root-cause analysis, traceability, weekly progress metrics |
| Muhammad Aun | m-aun-005 | (3) Use cases, usability and accessibility, security, performance | Risk register |

Every member writes and automates two use cases (each with at least two alternative and two
exception flows) and commits their own area's work. Any member may be examined on any component.

## System under test

- **Upstream:** https://github.com/Grashjs/cmms (Atlas CMMS)
- **Licence:** AGPL-3.0 (see `/LICENSE`). Paid features are covered separately by `/COMMERCIAL_LICENSE.MD`.
- **Baseline commit:** `a3c7ce38adedeb90ac13c280e8ccad6622ff2a42` (2026-11-21), tagged
  `baseline-a3c7ce3` in this repository.
- **Module under test:** Maintenance Requests → Work Orders (`RequestService`, `RequestController`).

Upstream's own GitHub workflows were moved to `.github/upstream-workflows-disabled/`
because they deploy using upstream's secrets.

## Contents

| Folder | Purpose | Owner area |
|---|---|---|
| `env/` | Seed (`seed.mjs`) and reset (`reset.mjs`) scripts for the fixed test data; see `docs/section-1-scope-and-test-basis.md` §1.8 | (2) API testing and test data |
| `pit-mutators/` | Custom PIT mutation operators based on our business rules | (1) static analysis, white-box, mutation, CI |
