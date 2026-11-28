# Section 3 — Usability and accessibility

Owner: Muhammad Aun (Area 3). All checks are automated, run against the seeded test accounts, and use no
participants.

## 3.1 Automated usability tests

`tests/team/e2e/tests/usability.spec.mjs` has one test per workflow.

| Test | Workflow | What it does | Assertions |
|---|---|---|---|
| **US-W1** | W1 submit | Uses **only the keyboard**. Focuses "+ Request" and presses Enter. Presses Tab through the whole form, typing the title when focus reaches it. Presses Enter on **Add**. | The first Tab lands on **Title\***. **Asset\*** is reached after Title. **Add** is reached after both. Enter submits. "Work Order successfully requested" is shown. The request is stored. |
| **US-W2** | W2 reject | First submits what BR-4 rejects (empty feedback), then corrects it. | "Feedback is required" is shown next to the field, and the field has `aria-invalid="true"`. The request is not rejected. After typing a reason, the dialog closes, the row shows **Rejected**, and the reason is stored. |

Measured focus order in the Add Request dialog: Title\* → Description → Location → (Location search button) →
Asset\* → (Asset search button) → Priority → Due date → (date picker) → Estimated start date → (date picker)
→ Estimated duration → Category → Primary worker → Team → … → **Add**. The order follows the visual layout.

**Usability findings from the tests**

| ID | Finding | Impact | Proposed fix |
|---|---|---|---|
| U1 | After **Reject**, the dialog closes with **no confirmation message**. Submit and edit both show one. The only feedback is the row's status changing to Rejected. | The user cannot be sure the action worked, especially if the row is not on the visible page. | Show a message such as "Request rejected", like the other actions. |
| U2 | **Asset** is marked required (\*) but the form submits without it. | Misleading: users may look for an asset they do not have, or think the form is broken. | Remove the asterisk, or enforce the field. |
| U3 | A title of only spaces passes the form's "required" check and is stored as an empty title (defect D2, #7). | A request without a readable title enters the queue. | Trim the title before the required check (`Yup.string().trim().required()`), and `@NotBlank` on the server. |

## 3.2 Key screens audited

One key screen per use case. The list is in `tests/team/e2e/a11y/screens.mjs`.

| ID | Use case | Screen | Signed in as | How Lighthouse reaches it |
|---|---|---|---|---|
| KS1 | UC-1 Submit | Add Request dialog | requester1 | snapshot after opening the dialog |
| KS2 | UC-2 Approve | **Request details with Approve/Reject** (screen fixed in §3.5) | admin | navigation to `/app/requests/{id}` |
| KS3 | UC-3 Reject | Reject dialog with Feedback | admin | snapshot |
| KS4 | UC-4 Track | Requests list | requester1 | navigation |
| KS5 | UC-5 Edit | Edit request dialog | requester1 | snapshot |
| KS6 | UC-6 Supervise | Requests queue | limitedAdmin | navigation |

The tools, both signed in:
- **axe-core:** `tests/team/e2e/tests/a11y-axe.spec.mjs` runs `@axe-core/playwright` with every rule.
- **Lighthouse 12.8.2:** `tests/team/e2e/a11y/lighthouse-flow.mjs` runs a user flow with accessibility, best practices and SEO, on Playwright's Chromium.

Reports are in `docs/evidence/a11y/before/` and `docs/evidence/a11y/after/`:
- `axe-KS*.json` and `axe-summary.json`;
- `lighthouse-flow.html` (open it in a browser) and `lighthouse-summary.json`.

## 3.3 Lighthouse scores before the fix

| Screen | Mode | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| KS1 Add Request dialog | snapshot | 83 | 100 | 80 |
| KS2 Request details | navigation | 89 | 96 | 54 |
| KS3 Reject dialog | snapshot | 89 | 100 | 80 |
| KS4 Requests list (requester) | navigation | 82 | 96 | 58 |
| KS5 Edit dialog | snapshot | 83 | 100 | 80 |
| KS6 Requests queue (limited admin) | navigation | 82 | 96 | 58 |

## 3.4 Issues found, each counted once

Lighthouse's accessibility audits are built on axe, so an issue reported by both tools is listed once and
marked "both". Counts are the axe node count summed over the six screens.

| # | Issue (rule) | Found by | Impact level | Screens | Element(s) | User impact | Proposed fix |
|---|---|---|---|---|---|---|---|
| A1 | **Buttons without an accessible name** (`button-name`) | both | critical | KS1, KS2, KS4, KS5, KS6 (34 nodes) | Icon-only buttons: Edit and Delete in the request details; the search buttons inside the Location and Asset fields; the row "more" (⋮) buttons and toolbar icons in the list | A screen-reader user hears only "button", with no idea what it does. | `aria-label` on each `IconButton` (fixed on KS2) |
| A2 | **Insufficient colour contrast** (`color-contrast`) | both | serious | all six (25 nodes) | Primary colour `#5569ff` on white or as background: **4.32:1** (needs 4.5:1), affecting Approve/Reject/Add buttons and links. The "Low" priority chip, white on `#33c2ff`: **2.03:1**. | Low-vision users and anyone in bright light cannot read button labels or the priority. | Primary `#4a5cf0` (5.15:1); chip text colour chosen against its own background (fixed) |
| A3 | **Zoom disabled** (`meta-viewport`) | both | critical | all six | `<meta name="viewport" … maximum-scale=1.0, user-scalable=0>` | Users who need to enlarge text (WCAG 1.4.4) cannot pinch-zoom. | Remove `maximum-scale` and `user-scalable` (fixed) |
| A4 | **ARIA attribute not allowed** (`aria-prohibited-attr`) | both | serious | KS4, KS6 | the notifications badge `<span aria-label="Notifications">` | The label is ignored or misread by assistive technology. | Put the label on the button around the badge, not on the `span` |
| A5 | **Content outside landmarks** (`region`) | axe | moderate | KS2, KS4, KS6 (47 nodes) | the request-details panel; list page sections | Screen-reader users cannot jump to the content by landmark. | Make the panel a named `section` (fixed on KS2); use `main` for page content |
| A6 | **No main landmark** (`landmark-one-main`) | axe | moderate | KS4, KS6 | `<html>` (layout) | No "skip to main content" target. | Wrap page content in `<main>` in the layout |
| A7 | **No level-1 heading** (`page-has-heading-one`) | axe | moderate | KS4, KS6 | `<html>` (layout) | Headings do not give a page outline. | Render the page title ("Requests") as `h1` |
| B1 | Errors logged in the browser console | Lighthouse | best practice | KS2, KS4, KS6 | console | No direct user impact; hides real errors. | Fix the failing calls behind the logged errors |
| S1 | No meta description | Lighthouse | SEO | all six | `<head>` | Low: the app is behind a login. | Add a `<meta name="description">` |
| S2 | Page blocked from indexing | Lighthouse | SEO | KS2, KS4, KS6 | robots | None. A private maintenance app should not be indexed, so this is accepted as intended. | No change |

**Totals: 10 distinct issues.** 4 were found by both tools, 3 by axe only and 3 by Lighthouse only.

## 3.5 Fixed screen: KS2 request details (decision screen of W2)

The changes are in the MIS frontend:

| Issue | Change | File |
|---|---|---|
| A1 | `aria-label` "Edit" and "Delete" on the two icon buttons | `frontend/src/content/own/Requests/RequestDetails.tsx` |
| A5 | The details container is a `section` named "Request details" (a region landmark) | same |
| A2 | Primary colour `#5569ff` → `#4a5cf0` (4.33 → 5.15:1) | `frontend/src/theme/schemes/PureLightTheme.ts` |
| A2 | Priority chip text colour now depends on the chip's own background. It used to depend on unrelated colours, which gave white on light blue. | `frontend/src/content/own/components/PriorityWrapper.tsx` |
| A3 | Zoom allowed | `frontend/public/index.html` |

### Before and after (same 6 screens, same tools, re-run after rebuilding the frontend)

**Fixed screen KS2: axe found 4 rules on 11 elements before, and none after.**

| Screen | axe before | axe after | Lighthouse accessibility before → after |
|---|---|---|---|
| **KS2 Request details (fixed)** | button-name ×2, color-contrast ×6, meta-viewport ×1, region ×2 | **none** | **89 → 100** |
| KS3 Reject dialog | color-contrast ×7, meta-viewport ×1 | none | 89 → 100 |
| KS1 Add Request dialog | button-name ×2, color-contrast ×3, meta-viewport ×1 | button-name ×2 | 83 → 94 |
| KS5 Edit dialog | button-name ×2, color-contrast ×4, meta-viewport ×1 | button-name ×2 | 83 → 94 |
| KS4 Requests list | 7 rules, 39 nodes | aria-prohibited-attr, button-name ×14, landmark-one-main, page-has-heading-one, region ×18 | 82 → 95 |
| KS6 Requests queue | 7 rules, 47 nodes | same 5 rules as KS4 | 82 → 93 |

Best practices (96–100) and SEO (54–80) did not change: their open items (B1, S1, S2) were outside the fix.

**What remains (not fixed, recorded for the completion report):**
- A1 on the list pages and in the Location/Asset field adornments, which are shared components;
- A4 (the notifications badge);
- A5–A7 page landmarks in the global layout.

The colour (A2) and zoom (A3) fixes are global, which is why the other screens improved as well.
