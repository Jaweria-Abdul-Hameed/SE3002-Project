# Section 2.4 — OpenAPI specification and test-data generator

Owner: Mohsin Khan (Area 2).

## 2.4.1 Specification

`tests/team/api/openapi.yaml` (OpenAPI 3.0.3) covers the five operations of W1 and W2:

| operationId | Method and path | Workflow |
|---|---|---|
| `createRequest` | `POST /requests` | W1 submit |
| `getRequest` | `GET /requests/{id}` | read-back |
| `editRequest` | `PATCH /requests/{id}` | W1 edit while pending |
| `approveRequest` | `PATCH /requests/{id}/approve` | W2 approve |
| `rejectRequest` | `PATCH /requests/{id}/cancel?reason=` | W2 reject |

**Why we wrote our own spec instead of using the project's.** The project's spec
(`/api/v3/api-docs/atlas-cmms`) is not accurate enough to generate data from:
- it gives `title` no length limits, although the database column is `VARCHAR(255)`;
- it gives the rejection `reason` no constraint, although BR-4 requires a non-blank reason;
- it lists no error responses.

Our spec states the **expected** behaviour (Section 1 §1.4–1.6):

| Input | Constraint | Source |
|---|---|---|
| `title` | required, `minLength 1`, `maxLength 255`, non-blank (`pattern \S`) | `@NotNull` on `WorkOrderBase.title`; DB column `VARCHAR(255)`; A-2 |
| `description` | `maxLength 10000` | upstream's own `@Schema(maxLength = 10000)` and `@Column(length = 10000)` |
| `priority` | enum `NONE, LOW, MEDIUM, HIGH` | `Priority` enum |
| `assetStatus` | enum of 7 members | `AssetStatus` enum |
| `reason` | required, `minLength 1`, non-blank | BR-4 (`RequestService.java:466`); A-4 for missing |
| `id` (path) | integer, `minimum 1` | database ids start at 1 |

Documented responses per operation: 200, 400, 403, 404 and 406, as each applies.

## 2.4.2 Generator

`tests/team/api/generator/generate.mjs` reads the spec and writes `generated/test-data.json`. Run it with
`npm run generate` in `tests/team/api`.

| Spec keyword | Generated cases |
|---|---|
| `required` | EP invalid: missing; for body fields also `null` |
| `type: string` (JSON body) | EP invalid: a number instead of a string |
| `pattern: '\S'` | EP invalid: whitespace only |
| `minLength n` | BVA n−1 (invalid if n > 0), n, n+1 |
| `maxLength m` | BVA m−1, m, m+1 (invalid) |
| `enum` | EP valid: every member; EP invalid: unknown member, wrong case, empty string |
| `integer, minimum k` | BVA k−1 (invalid), k, k+1; EP invalid: negative, non-numeric, decimal |
| no `minLength`, optional | EP valid: empty string |

Every operation also gets a **base request**: a valid value for every input. Each case changes **exactly
one** input of that base, so a rejection can only come from that input ("one invalid value per test").

**Output for the current spec** (spec hash `13cdb7751e68b4c1`): 90 cases.

| Operation | Cases | Valid | Invalid |
|---|---|---|---|
| `createRequest` | 24 | 13 | 11 |
| `getRequest` | 7 | 2 | 5 |
| `editRequest` | 29 | 15 | 14 |
| `approveRequest` | 17 | 9 | 8 |
| `rejectRequest` | 13 | 4 | 9 |

The API tests (Section 2.5) read `generated/test-data.json` directly. CI regenerates the file from the spec
and fails if the committed file is out of date.

## 2.4.3 Changing two constraints

`tests/team/api/demo/openapi.changed.yaml` changes two constraints:
1. `title.maxLength` from 255 to **120**, in both create and edit;
2. `reason.minLength` from 1 to **10**.

Regenerate and compare:

```
node generator/generate.mjs demo/openapi.changed.yaml demo/test-data.changed.json
node report/compare-data.mjs generated/test-data.json demo/test-data.changed.json
```

The effect (`demo/effect-of-change.txt`): the number of cases stays at 90, but the boundary values move.

| Constraint | Old cases (removed) | New cases (added) |
|---|---|---|
| title `maxLength` 255 → 120 (create and edit) | lengths 254, 255 valid; 256 invalid | lengths 119, 120 valid; **121 invalid** |
| reason `minLength` 1 → 10 | lengths 0 invalid; 1, 2 valid | lengths **9 invalid**; 10, 11 valid |

Run against the baseline, the new invalid cases (a 121-character title, a 9-character reason) are accepted.
The API does not enforce the changed limits, so the tests would report the difference. That is exactly what
a spec change should surface.

**In the viva:**
- edit a constraint in `openapi.yaml`;
- run `npm run generate`;
- run the comparison;
- run `npm test`.
