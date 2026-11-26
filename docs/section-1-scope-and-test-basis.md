# Section 1 — System, scope and test basis

## 1.1 System under test

| Item | Value |
|---|---|
| System | Atlas CMMS (computerised maintenance management system) |
| Upstream repository | https://github.com/Grashjs/cmms |
| Licence | AGPL-3.0 (`/LICENSE`). Upstream also offers an optional commercial licence (`/COMMERCIAL_LICENSE.MD`); we use only the AGPL edition and need no licence key. |
| Baseline commit | `a3c7ce38adedeb90ac13c280e8ccad6622ff2a42` (2026-11-21), tagged `baseline-a3c7ce3` in this repository |
| Our repository | https://github.com/Jaweria-Abdul-Hameed/SE3002-Project |
| Stack | Spring Boot 3.5 / Java 17 API, PostgreSQL 16 (Liquibase), MinIO, React 17 frontend behind nginx |
| Module under test | Maintenance Requests → Work Orders (`RequestController`, `RequestService`) |

**Why it is an MIS.** Atlas records and coordinates an organisation's maintenance work: requests from
staff, work orders for technicians, assets, locations and parts, with role-based access. Our module is
the intake point of that process: a request from a staff member becomes a tracked work order only
after a manager decides on it.

**How it meets the selection criteria.**
- **Browser interface:** React app at http://localhost:3000. Screens: *Requests* and *Work Orders*.
- **HTTP API:** `POST /api/requests`, `PATCH /api/requests/{id}/approve`, `PATCH /api/requests/{id}/cancel`, `GET /api/requests/{id}`.
- **Persistent storage:** PostgreSQL tables `request` and `work_order`.
- **Testable source:** `api/src/main/java/com/grash/service/RequestService.java`.

## 1.2 Workflows

| | W1 — Submit a maintenance request | W2 — Review a request (approve or reject) |
|---|---|---|
| Actor | Requester | Admin or Limited Admin |
| Starting condition | Seeded company exists. `requester1@se3002.test` is signed in. No requests exist. | A pending request from W1 exists (not cancelled, no work order). The company has fewer than 30 incomplete work orders. The reviewer is signed in. |
| User action | *Requests* → **+ Request** → enter Title "Leaking tap in Room 101", Priority Medium → Save. API: `POST /api/requests`. | Open the request → **Approve**. API: `PATCH /api/requests/{id}/approve`. Alternative: **Reject**, enter Feedback, confirm. API: `PATCH /api/requests/{id}/cancel?reason=…`. |
| Expected outcome | HTTP 200. The request is stored with an ID `R000001`, `cancelled = false`, and no work order. It appears in the Requests list as **Pending**, visible only to its creator and to reviewers. | **Approve:** HTTP 200. A work order is created with status **OPEN**, the request's title, and `parentRequest` = the request. The request now references the work order and shows **Approved**. **Reject:** HTTP 200. `cancelled = true` and the reason is stored. The request shows **Rejected**. No work order is created. |

**Shared record.** W1 creates the `request` row. W2 reads that row's state (`work_order_id`,
`cancelled`) to decide whether the action is allowed, then changes it:
- approving sets `work_order_id` and inserts a `work_order` row whose `parent_request_id` points back;
- rejecting sets `cancelled` and `cancellation_reason`.

W2 also reads a second shared value: the company's count of incomplete work orders (BR-3).

## 1.3 User roles

These are the built-in roles, from `api/src/main/java/com/grash/utils/Helper.java`.

| Role | Paid seat | Create requests | View *Settings* permission | Approve / reject requests |
|---|---|---|---|---|
| **Admin** (primary role 1) | yes | yes | yes | **yes**: condition A of BR-1 |
| **Requester** (primary role 2) | no | yes | no | **no** |
| Limited Admin (supporting) | yes | **no** (`Helper.java:255` excludes REQUESTS) | no | **yes**: condition B of BR-1 |

The two roles with different permissions are **Admin** and **Requester**. Limited Admin is included
because it is the only role that reaches condition B of the decision rule.

## 1.4 Functional requirements

"Observed" is the behaviour seen on the baseline build on 2026-11-26 (seeded data, API calls). **Bold**
entries do not match the expected behaviour and are carried into defect reporting.

| ID | WF | Requirement (expected behaviour) | Source | Observed |
|---|---|---|---|---|
| FR-01 | W1 | A user whose role may create requests can submit one. It is stored pending (`cancelled=false`, no work order) with a sequential ID `R` + 6 digits. | `RequestService.java:317-322, 110-111` | 200, `R000001` |
| FR-02 | W1 | A request must have a title. | `WorkOrderBase.java:47` (`@NotNull`); UI: "Request title is required" | Missing title: 400 "must not be null". **Empty `""` or blank `"   "` title: 200, stored as `""`** |
| FR-03 | W1 | A user whose role lacks create permission for requests (Limited Admin) is refused. | `RequestService.java:318, 322` | 403 "Access denied" |
| FR-04 | W1 | A Requester can view only their own requests. | `Request.java:74` (`canBeViewedBy`), `RequestService.java:310-312` | Other requester: 403; owner: 200 |
| FR-05 | W1 | The creator can edit a request while it is pending; fields not sent are kept. | `RequestService.java:360-371` | 200, **but priority and description not sent were reset (HIGH→NONE, text→null)** |
| FR-06 | W2 | Approving a pending request creates an OPEN work order linked both ways to the request. | `RequestService.java:387-451, 195-204` | 200, WO #1 OPEN, `parentRequest`=1 |
| FR-07 | W2 | Only a user with *Settings* view permission or the Limited Admin role may approve or reject (BR-1). | `RequestService.java:376, 458` | Requester: 403 "Forbidden"; Admin and Limited Admin: 200 |
| FR-08 | W2 | Rejecting requires a non-blank reason, which is stored with the request (BR-4). | `RequestService.java:466-469` | Blank: 406 "Please give a reason"; valid: 200, reason stored. **Reason parameter missing entirely: 500** |
| FR-09 | W2 | An approved request cannot be approved again, rejected, or edited (BR-2). | `RequestService.java:391-395, 463-465, 365-367` | 406 "Request is already approved" / "Can't patch an approved request" |
| FR-10 | W2 | Approval is refused when the company already has 30 incomplete work orders, and the request stays pending (BR-3). | `WorkOrderService.java:191-200`, `Consts.java:52` | 30th approval: 200; next: 403 "Free Limit of 30 incomplete work orders reached"; request still pending |
| FR-11 | W2 | Acting on a request that does not exist returns 404. | `RequestService.java:452` | 404 "Request not found" |
| FR-12 | W2 | A rejected (cancelled) request cannot be approved (BR-2, assumption A-1). | assumption A-1 | **200: a work order is created for a rejected request** |

That is 12 requirements: 5 for W1 and 7 for W2.

## 1.5 Business rules

| ID | Type required by brief | Rule | Code |
|---|---|---|---|
| BR-1 | Decision with two Boolean conditions | A user may approve or reject a request only if **(A)** their role's view permissions include SETTINGS **or** **(B)** their role code is LIMITED_ADMIN. Otherwise 403. | `RequestService.java:376` (approve), `:458` (cancel) |
| BR-2 | Change of state | A request is **Pending** until reviewed. Pending → **Approved** (approve) or Pending → **Rejected** (cancel). Approved is final: approve, cancel and edit are refused with 406. | `RequestService.java:365, 391, 463` |
| BR-3 | Boundary / limit | A company may have at most **30** incomplete (non-COMPLETE) work orders. Approval creates one, so it is refused with 403 once 30 exist. | `WorkOrderService.java:191-200`; `Consts.java:52` |
| BR-4 | Validation rule | Rejecting a request requires a reason that is not empty after trimming. Otherwise 406 "Please give a reason". | `RequestService.java:466-467` |

**What each rule means for testing**
- **BR-1, decision table.** There are four combinations:
  - A=T, B=F (Admin): allowed.
  - A=F, B=T (Limited Admin): allowed.
  - A=F, B=F (Requester, Technician): denied.
  - A=T, B=T: **cannot be reached through the application.** It is covered at unit level only, with a mocked role. Two reasons:
    - Built-in roles cannot be edited by a company. Adding SETTINGS to the Limited Admin role returned 403 "Access denied" (`RoleService.java:63`).
    - Custom roles are always saved with code `USER_CREATED` (`RoleService.java:51`), so B is false for them. Creating one also needs a licence (`RoleService.java:35`).

  MC/DC for `A || B` needs only (T,F), (F,T) and (F,F), and all three are reachable with the seeded users. Only MCC needs the unreachable fourth combination.

- **BR-1 is the API's rule, not the UI's.** The UI applies a stricter condition before showing **Approve** and **Reject**: `(A || B) && the role may create work orders` (`RequestDetails.tsx:185-187`). The API does not check the third condition.
  - With the built-in roles this makes no difference, because Admin and Limited Admin may both create work orders.
  - It is still a UI/API inconsistency, so it is recorded as an observation for the security assessment rather than as a business rule. A rule counts only if the server enforces it.
- **BR-2, state transitions.**
  - Allowed: Pending→Approved and Pending→Rejected.
  - Disallowed from Approved: approve, cancel, edit.
  - Disallowed from Rejected (expected, per A-1): approve. The baseline allows it (FR-12).
- **BR-3, 3-point boundary.** With 29 incomplete work orders, approval succeeds (making 30). With 30, approval is refused (it would make 31). A run must start with a known count, so tests reset first (§1.8).
- **BR-4, equivalence partitions.** Missing reason, empty reason, whitespace-only reason, and a valid reason.

The UI calls BR-4's reason **Feedback**. Its Reject dialog says "Feedback is required".

## 1.6 Expected behaviour not stated by upstream (justified assumptions)

Upstream has no written specification for requests. Expected behaviour is taken from the code above,
the UI's own validation messages and labels, and these assumptions:

- **A-1. A rejected request is final and cannot be approved.**
  - The UI hides **Approve** and **Reject** once a request is cancelled (`RequestDetails.tsx`).
  - The approve path guards against approving twice but never checks `cancelled`.
  - The baseline therefore produces a request that is both rejected and linked to an open work order. The list shows it as "Rejected" (`Requests/index.tsx:317-321`) while maintenance work is scheduled for it.
- **A-2. A title made only of whitespace is not a title.** The UI requires a title ("Request title is required"), and the API's `@NotNull` intends the same.
- **A-3. `PATCH` changes only the fields sent.** This is the standard meaning of PATCH. Erasing priority and description loses data the requester entered.
- **A-4. Invalid client input returns 4xx, not 500.** A missing `reason` parameter is a client error.

## 1.7 Scope

- **In scope:**
  - both workflows through the UI and the API;
  - the four rules;
  - the request and work-order records they share;
  - roles Admin, Requester and Limited Admin.
- **Out of scope:**
  - the public request portal and voice notes (these need a licence key);
  - automation workflows and webhooks;
  - file attachments;
  - the mobile app;
  - work-order execution after it is created.

**In-scope code.** Coverage and mutation targets are limited to the members listed here. Other code in
the same files is out of scope: notifications, webhooks, e-mail, the request portal, automation workflows,
and search.

| Layer | File | In scope |
|---|---|---|
| API | `api/src/main/java/com/grash/controller/RequestController.java` | `POST /requests`, `GET /requests/{id}`, `PATCH /requests/{id}`, `PATCH /requests/{id}/approve`, `PATCH /requests/{id}/cancel` |
| API | `api/src/main/java/com/grash/service/RequestService.java` | `create`, `getById`, `patch`, `approve`, `approveInternal`, `cancel`, `createWorkOrderFromRequest`. **This is the main target for unit tests, coverage and mutation.** |
| API | `api/src/main/java/com/grash/service/WorkOrderService.java` | `create`, `checkUsageBasedLimit` (BR-3) |
| API | `api/src/main/java/com/grash/repository/WorkOrderRepository.java` | `hasMoreActiveThan` (BR-3 count) |
| API | `api/src/main/java/com/grash/utils/Consts.java` | `usageBasedFreeLimits` (the limit of 30) |
| API | `api/src/main/java/com/grash/utils/Helper.java` | `getDefaultRoles` (built-in role permissions) |
| API | `api/src/main/java/com/grash/model/Request.java` | `cancelled`, `cancellationReason`, `workOrder`, `canBeViewedBy`, `canBeEditedBy` |
| API | `api/src/main/java/com/grash/model/abstracts/WorkOrderBase.java` | `title` validation (`@NotNull`) |
| UI | `frontend/src/content/own/Requests/index.tsx` | Requests list, status labels, the **+ Request** form and its validation |
| UI | `frontend/src/content/own/Requests/RequestDetails.tsx` | **Approve** and **Reject** buttons and their visibility condition |
| UI | `frontend/src/content/own/Requests/RequestCancellationModal.tsx` | the Reject dialog's required **Feedback** field |

## 1.8 Environment: install, start, seed, reset

Requirements: Docker Desktop and Node.js 18 or newer. All commands run from the repository root.

| Step | Command |
|---|---|
| Install (once) | `git clone https://github.com/Jaweria-Abdul-Hameed/SE3002-Project.git` then `cp .env.example .env` (never commit `.env`) |
| Start | `docker compose -f docker-compose.yml -f docker-compose.source.yml up -d --build` (the first build takes about 10 minutes) |
| Seed test data | `node tests/team/env/seed.mjs` |
| Reset between runs | `node tests/team/env/reset.mjs` (deletes all data, restarts, waits for the API, re-seeds; about 30 s) |
| Stop | `docker compose -f docker-compose.yml -f docker-compose.source.yml down` |

- **Why `docker-compose.source.yml`.** Plain `docker compose up` downloads upstream's latest prebuilt images, which are not our baseline. The override builds the API and frontend from this repository's source.

**Seeded data** (`tests/team/env/seed.mjs`). One company, *SE3002 Test Facility*, with four users. The password for all of them is `Se3002-Test-Pass!`.

| User | Role |
|---|---|
| `admin@se3002.test` | Admin |
| `limited.admin@se3002.test` | Limited Admin |
| `requester1@se3002.test` | Requester |
| `requester2@se3002.test` | Requester |

The seed goes through the public API, so it obeys the application's own rules.

**Constraints that affect test runs** (measured on the baseline):
- **Paid seats.** The free tier allows 5 paid seats (Admin, Limited Admin, Technician) across the whole installation, and no second company once one has 5 work orders. Tests therefore share the one seeded company; they never create a company per test.
- **BR-3.** Every approval adds an incomplete work order, so suites that approve reset first.
- **Rate limits** (`application.yml`, defaults kept):
  - signed-in users: 100 requests per minute each;
  - anonymous clients: 20 per minute and 80 per hour per IP;
  - 5 failed logins per email per 15 minutes.

  Test suites sign in once and reuse the token. Load tests give each simulated user its own Requester account.
