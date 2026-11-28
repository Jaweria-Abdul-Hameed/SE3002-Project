# Section 2.6 — Use cases and browser end-to-end tests

Two use cases per member. Each has a main flow, two alternative flows and two exception flows. Every flow is
automated in Playwright (Chromium) in `tests/team/e2e/tests/`. Each test asserts what the screen shows **and**
the stored postcondition, which it reads back through the API.

Each spec file resets and re-seeds the system first (test plan §2.2.5). Run them with
`cd tests/team/e2e && npm ci && npx playwright test`. The HTML report is written to `playwright-report/`.

| UC | Name | Actor | Owner | Spec file |
|---|---|---|---|---|
| UC-1 | Submit a maintenance request | Requester | Jaweria | `uc1-submit-request.spec.mjs` |
| UC-2 | Approve a maintenance request | Admin / Limited Admin | Jaweria | `uc2-approve-request.spec.mjs` |
| UC-3 | Reject a request with feedback | Admin / Limited Admin | Mohsin | `uc3-reject-request.spec.mjs` |
| UC-4 | Follow the progress of my request | Requester | Mohsin | `uc4-track-request.spec.mjs` |
| UC-5 | Edit a pending request | Requester (creator) | Aun | `uc5-edit-request.spec.mjs` |
| UC-6 | Supervise the request queue | Limited Admin | Aun | `uc6-supervise-requests.spec.mjs` |

---

## UC-1 Submit a maintenance request (W1)

- **Precondition:** the requester is signed in.
- **Postcondition (success):** a request is stored, not cancelled, with no work order, and listed as **Pending**.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Requests → **+ Request** → Title "UC1 Leaking tap in Room 101" → **Add** | "Work Order successfully requested"; the row shows Pending; stored pending | UC1-M |
| A1 | Same, with a Description and Priority **High** | The details show High; priority HIGH and the description are stored | UC1-A1 |
| A2 | Open own pending request → Edit → correct the title → **Save** | "The changes have been saved"; the new title is stored | UC1-A2 |
| E1 | Leave Title empty → **Add** | "Request title is required"; the dialog stays open; nothing stored | UC1-E1 |
| E2 | Title of spaces only → **Add** | Should be refused (A-2). **Known defect D2:** it is stored as `""`. The test is marked as an expected failure. | UC1-E2 |

## UC-2 Approve a maintenance request (W2, BR-1 to BR-3)

- **Precondition:** a pending request exists; the reviewer is signed in; the company has fewer than 30 incomplete work orders.
- **Postcondition (success):** exactly one **OPEN** work order is linked to the request, and the work-order page is shown.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Admin opens the request → **Approve** | The work-order page opens with the request's title; the request is linked to one OPEN work order | UC2-M |
| A1 | Limited Admin approves (BR-1 condition B) | Same as the main flow | UC2-A1 |
| A2 | Admin types part of the title in **Search**, opens the row, approves | Same as the main flow | UC2-A2 |
| E1 | A Requester opens their own request | No Approve or Reject buttons (BR-1); still pending | UC2-E1 |
| E2 | 30 incomplete work orders already exist → Admin approves | Approval refused (BR-3); the page stays on Requests; the request stays pending with no work order | UC2-E2 |

## UC-3 Reject a request with feedback (W2, BR-1, BR-4)

- **Precondition:** a pending request exists; the reviewer is signed in.
- **Postcondition (success):** the request is cancelled, the feedback is stored as the reason, and no work order exists. The list shows **Rejected**.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Admin opens the request → **Reject** → Feedback "Duplicate of R000001" → **Reject** | The dialog closes; the row shows Rejected; reason stored; no work order | UC3-M |
| A1 | Limited Admin rejects with feedback | Cancelled; reason stored | UC3-A1 |
| A2 | Admin opens the Reject dialog, then closes it (Esc) | Still pending; Approve is still offered | UC3-A2 |
| E1 | **Reject** with empty Feedback | "Feedback is required"; not cancelled | UC3-E1 |
| E2 | Feedback of spaces only | The server refuses it (BR-4, 406); not cancelled; no reason stored | UC3-E2 |

## UC-4 Follow the progress of my request

- **Precondition:** the requester is signed in and has submitted requests.
- **Postcondition:** the requester sees only their own requests, each with its current status.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Open Requests | Own request listed as Pending | UC4-M |
| A1 | The request was approved by an Admin | Listed as Approved; a work order exists | UC4-A1 |
| A2 | The request was rejected | Listed as Rejected; the details show Cancelled | UC4-A2 |
| E1 | Another requester also submitted a request | It is **not** listed | UC4-E1 |
| E2 | Open another requester's request by its address | No details are shown; the API answers 403 | UC4-E2 |

## UC-5 Edit a pending request (FR-05, BR-2)

- **Precondition:** the creator is signed in; their request is pending.
- **Postcondition (success):** the changed fields are stored, and the fields not changed are kept.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Open own request → Edit → change Title → **Save** | "The changes have been saved"; new title stored | UC5-M |
| A1 | Change only the Priority to High | Priority HIGH stored; title and description kept | UC5-A1 |
| A2 | Open Edit, type a new title, close with Esc | Nothing changes | UC5-A2 |
| E1 | Clear the Title → **Save** | "Request title is required"; title unchanged | UC5-E1 |
| E2 | An Admin approves while the edit dialog is open → **Save** | "The Request couldn't be edited" (BR-2, 406); title unchanged | UC5-E2 |

UC5-A1 passes even though D3 exists, because the UI sends the whole form and not only the changed field. D3
is reached only through the API (Section 2.5, API-PATCH-01).

## UC-6 Supervise the request queue (Limited Admin)

- **Precondition:** the Limited Admin (maintenance supervisor) is signed in.
- **Postcondition:** the supervisor decides pending requests from all requesters but cannot submit requests.

| Flow | Steps | Expected result | Test |
|---|---|---|---|
| Main | Open a pending request → **Approve** | The work-order page opens; one OPEN work order | UC6-M |
| A1 | **Reject** with feedback | Cancelled; reason stored | UC6-A1 |
| A2 | Open Requests: both requesters' requests are listed; open one | The details offer Approve | UC6-A2 |
| E1 | Look for **+ Request** | Not shown; the API refuses a submission with 403 | UC6-E1 |
| E2 | Open an already approved request by its address | No Approve or Reject offered (BR-2); still one work order | UC6-E2 |

---

## Results (local run, 2026-11-28)

**30 flows: 29 pass, plus UC1-E2, which fails as expected and documents defect D2 (#7).** In that run the
number of stored requests went from 3 to 4 after a title of spaces was submitted. CI runs the same suite in
the `system-tests` job, and the HTML report is kept as the artifact `playwright-report`.

**Problem found while automating.** The first run failed on the fourth test of each file. Signing in through
the login page makes several anonymous API calls, and the API allows only 20 a minute per IP, so later logins
received HTTP 429 and never finished. Logging in is not part of any use case, so each user now signs in once
through the API, and the test page starts with that session (`tests/lib.mjs`, `login`). This is the same rate
limit as in Section 2.5.

**Coverage of the requirements by use case:**
- FR-01, FR-02: UC-1
- FR-03: UC-6
- FR-04: UC-4
- FR-05: UC-1, UC-5
- FR-06, FR-07: UC-2, UC-6
- FR-08: UC-3, UC-6
- FR-09: UC-5, UC-6
- FR-10: UC-2
