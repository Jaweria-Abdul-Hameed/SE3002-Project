# AI-use record

The brief (§7) allows AI tools only when every output is checked and disclosed with the tool, purpose,
output, and what we checked or changed. This record covers every AI-assisted item in the project. A row is
added in the same commit as the work it describes.

## Tools

| Tool | Model | How it was used |
|---|---|---|
| Claude Code (CLI) | Claude Opus 5.5 (`claude-opus-5-5`) | Read the brief and the upstream code. Ran commands (Docker, Maven, Node). Wrote files and made commits. |

## Prompts

The brief says "Keep your prompts". Every prompt and reply is in the Claude Code session transcripts below.
A copy is kept outside the repository by Jaweria. The "Prompt" column refers to them.

| Ref | Session file | Dates | Content |
|---|---|---|---|
| S0 | `41f7207e-26d8-452e-ac94-7be5ad715858.jsonl` | 2026-11-25 | Audit of an earlier candidate system (NEMO) that we dropped |
| S1 | `6ce2c12b-0936-4022-b21e-7009dbdcd145.jsonl` | 2026-11-25 | First suitability check of Atlas CMMS, plus the draft analysis and licence questions later pasted into S2 |
| S2 | `78530597-e3ae-4bf7-8621-2d999d3cb9a4.jsonl` | 2026-11-25 to 2026-11-27 | Main session: everything from repository selection onwards |

## Record

| # | Date | Member | Purpose | AI output | What we checked or changed | Member review | Prompt |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-25 | Jaweria | Check an earlier candidate system (NEMO) against the brief | Gap list. Nothing kept in this repository. | We dropped that system and chose Atlas CMMS instead. | Jaweria ✔ | S0 |
| 2 | 2026-11-25 | Jaweria | Is Atlas CMMS suitable, and does it count as an MIS? | Suitability assessment, candidate business rules and workflow pairs | Asked whether mutation testing is possible with the listed tools and whether a PIT plugin satisfies "add custom operators". Chose the plugin option. Chose Requests → Work Orders over the inventory pair. | Jaweria ✔ | S1, S2 |
| 3 | 2026-11-25 | Jaweria | Check our own draft analysis (registration, rules, roles) | List of corrections: boundary rule = the 30-work-order cap; the reason check is the 4th rule; build from source, not upstream images; the brief's page numbers | Accepted the corrections before registering. | Jaweria ✔ | S2 |
| 4 | 2026-11-25 | Jaweria | Set up the repository | Cloned upstream, pinned and tagged baseline `a3c7ce38`. Moved upstream's deploy workflows out of `.github/workflows` (commit `1c941c1d`). | AI checked through the GitHub API: 0 active workflows, 0 runs. | Jaweria ✔ | S2 |
| 5 | 2026-11-25 | Jaweria | Build the custom mutation operators (Area 1) | PIT plugin `tests/team/pit-mutators` with `DROP_ROLE_ALTERNATIVE` and `IGNORE_APPROVAL_STATE`, plus 9 unit tests (commit `b5fef901`) | AI ran the plugin's tests (9 pass) and an end-to-end PIT run. 2026-11-26: re-run on the real `RequestService`. Both operators load and generate mutants, and `DROP_ROLE_ALTERNATIVE` survives at lines 376 and 458, which our tests must kill. Jaweria to be able to explain the bytecode change of each operator. | Jaweria: pending | S2 |
| 6 | 2026-11-25 | Jaweria | Is Atlas free to use, and what do its free-tier caps mean for us? | Explanation of the AGPL vs commercial licence and the usage caps (5 paid users, 30 active work orders) | Compared it with the licensing answer from S1. Confirmed that the workflows need no licence key. | Jaweria ✔ | S2 |
| 7 | 2026-11-25 | Muhammad Aun | Team section for the testing workspace README | Team section in `tests/team/README.md` (commit `48e9c937`) | Checked that the README states the upstream, licence, baseline and module correctly. | Aun: pending | S2 |
| 8 | 2026-11-25 | Jaweria | Run the app locally; explain the workflows' UI | `.env` from `.env.example`, a build from source, an API smoke script, and a UI walkthrough | AI checked both workflows through the API. This also confirmed defect D1 (approving a cancelled request creates a work order). | Jaweria ✔ | S2 |
| 9 | 2026-11-26 | Jaweria | Area split suggestion | Proposed split based on the marks for each area | Approved by the group (commit `89173edc`). | Jaweria ✔ | S2 |
| 10 | 2026-11-26 | Jaweria | Do the free-tier limits affect our runs and the viva? | Analysis of the limits | Jaweria challenged an earlier statement ("the workflows are least affected"). The AI re-read the code and corrected itself: the 5-paid-user cap and the one-company rule apply to the whole installation, not per company. Also asked whether a dual-licensed system is valid for the brief, and how it compares with the ERPNext example. | Jaweria ✔ | S2 |
| 11 | 2026-11-26 | Jaweria | Prove every section is feasible with concrete results | Scratch runs, not committed: k6, PIT and JaCoCo, SonarQube, ZAP, Playwright and axe, Lighthouse, npm audit, Testcontainers | Jaweria asked for "actual concrete results, nothing ambiguous". The run found the rate limits (429). **None of these outputs or AI-taken screenshots are submitted as evidence.** Members will re-run each tool themselves in the relevant section. | Jaweria ✔ | S2 |
| 12 | 2026-11-26 | Jaweria | Check our Google Sheet registration | Review of the registration text | The AI flagged "for an asset" in W1 as untested. Jaweria fixed the Sheet. | Jaweria ✔ | S2 |
| 13 | 2026-11-26 | Mohsin Khan | Seed and reset scripts for test data (Area 2) | `tests/team/env/seed.mjs`, `reset.mjs` (commit `02ccd54b`) | AI ran `reset.mjs` end to end: ready in about 28 s, 4 users seeded. Mohsin to be able to explain why users are invited before signing up with a role, and why tests share one company. | Mohsin: pending | S2 |
| 14 | 2026-11-26 | Jaweria | Apply the teacher's announcement (AI use, screenshots, plagiarism, demos) to how we work | Working rules: (a) no screenshot taken by the AI is used; (b) every document is specific to our module (our code lines, our measured results) and members rephrase the prose in their own words; (c) each deliverable comes with notes so its owner can explain it in the viva | Jaweria shared the announcement in the prompt of 2026-11-26 16:36 UTC. **We decided that Jaweria (and each member for their own area) takes every screenshot herself.** The AI only gives the steps or commands to run. | Jaweria ✔ | S2 (2026-11-26 16:36 UTC) |
| 15 | 2026-11-26 | Jaweria | How will the Markdown sections become the final PDF report? | Plan: each section stays as Markdown in `docs/` next to its evidence. At the end, one PDF is built from those files in the brief's order (pandoc), and the zip is made from the final commit. | Agreed to keep sections in Markdown. Template or formatting to be confirmed with the teacher's expectations later. | Jaweria ✔ | S2 (2026-11-26 16:46 UTC) |
| 16 | 2026-11-26 to 27 | Jaweria | Section 1: scope, workflows, requirements, rules, environment | `docs/section-1-scope-and-test-basis.md`, `docker-compose.source.yml` (commit `8654df4f`) | AI re-ran every requirement against the live app. This found D2 (blank title accepted), D3 (PATCH erases priority and description), and a 500 when the reason is missing. Jaweria reviewed the draft and then: (a) asked how Admin and Limited Admin differ and what "Settings" means; (b) asked for file names to be added to the scope, so §1.7 now lists files and methods; (c) asked whether the UI's 3-condition button check is a business rule, so it is recorded as a UI/API observation instead; (d) the AI re-tested its own claim about the A=T, B=T combination and corrected it (built-in roles cannot be edited: 403). | Jaweria ✔ | S2 |
| 17 | 2026-11-27 | Jaweria | This record | `docs/ai-use-record.md` | Jaweria pointed out that the record should include the edits and changes she asked for while reviewing. She then asked for the teacher-announcement decision (row 14) and the report-format question (row 15) to be added, and for commit-mechanics notes to be left out. | Jaweria: pending | S2 |
| 18 | 2026-11-25 | Jaweria | What does the brief require for the CI gate and pull requests? | Explanation of §2 of the brief: SonarQube, all tests and mutation on every pull request; merge and deployment blocked below the thresholds; no escape hatches; one documented fix through a pull request that fails before and passes after; one pull request the pipeline blocked | Planned for the CI part of Area 1. Not built yet. | Jaweria ✔ | S2 |
| 19 | 2026-11-25 | Jaweria | Keep the project's context between Claude Code sessions | Claude Code's local memory notes (outside the repository): repository setup, decisions, verified behaviour | Jaweria reviewed the summary the next morning before continuing. | Jaweria ✔ | S2 |
| 20 | 2026-11-27 | Jaweria | Section 2.1: SonarQube analysis and hand-calculated cyclomatic complexity | `tests/team/sonar/run-sonar.mjs` (SonarQube in Docker, project metrics, per-method complexity via rule java:S1541 with threshold 1); `docs/section-2-1-sonarqube-and-complexity.md` (decision points, CFG, V(G) by two formulas, comparison, 8 basis paths) for `RequestService.cancel` | AI validated the script in probe mode (SonarQube gives `cancel` = 8, the same as the hand calculation) and deleted its own output. The metrics and screenshots come from Jaweria's own run. On self-check the AI corrected its lambda count from 3 to 5. Jaweria redraws the CFG by hand. Jaweria ran the full analysis herself (2026-11-27 12:12 UTC). The AI filled the metrics table from her `project-metrics.json` and drafted the notes from SonarQube's issue breakdown (the blocker bug behind Reliability E; java:S4684 behind Security D). | Jaweria: pending | S2 |
| 21 | 2026-11-27 | Jaweria | Build the CI quality gate early instead of at step 2.8 | `.github/workflows/quality-gate.yml` (jobs: tests, sonarqube, deploy to GHCR only after both gates pass on main); `tests/team/ci/sonar-setup.sh` (fresh SonarQube container, our own gate on overall in-scope code: no regression from the baseline, Security no worse than D, Reliability no worse than C); pull request #1 | Jaweria asked whether SonarQube must also run in GitHub Actions and chose to build CI early. Run 1 failed (curl exit 56 while SonarQube was still booting), so the AI rewrote the wait loop without `\|\| true`. Run 2 failed on SonarQube's password policy. Run 3 showed the gate working but failing: the AI had set Security A from the two service files only, while `RequestController` rates D (9 mass-assignment findings). The AI corrected the thresholds to the measured in-scope baseline. Jaweria asked for PR #1 to be merged and branch protection set up (pull request required; `tests` and `sonarqube` checks; applies to admins). The first run on main failed on a Maven Central 429. Pull request #2 added download retries and builds the deployment image from the CI-built JAR. | Jaweria: pending | S2 |
| 22 | 2026-11-27 | Jaweria, Aun, Mohsin | Section 2.2: test plan, risk register, exit criteria, estimation, traceability | `docs/section-2-2-test-plan.md` (Jaweria), `docs/section-2-2-risk-register.md` (Aun: 12 product and 4 project risks, 5 × 5), `docs/section-2-2-traceability.md` (Mohsin) | The schedule is based on Jaweria's plan to finish Sections 2–5 by about 3 am on 28 Nov, with submission on 29 Nov at 23:59. Risks use the defects and limits measured in Section 1 and the feasibility runs. Each owner reviews their file. | Jaweria: pending; Aun: pending; Mohsin: pending | S2 |
| 23 | 2026-11-28 | Jaweria | Section 2.3: white-box unit tests (basis paths, MCC, MC/DC, 100 % coverage) | `tests/team/unit/.../RequestServiceTeamTest.java` (48 tests), `WorkOrderLimitTeamTest.java` (4 tests); Maven profile `team` in `api/pom.xml` (our tests only, PIT with the 2 custom operators, out-of-scope methods excluded); `tests/team/ci/check-coverage.mjs` (EX-2 gate); CI runs tests, the coverage gate and PIT; `docs/section-2-3-unit-tests.md` | The first run had 1 failure caused by the AI's own test fixture: its Limited Admin could create requests, unlike the real role. The fixture was corrected to mirror `Helper.java:255`. The AI first wrote a suite with strong side-effect assertions (92 % mutation score, only 9 survivors). The brief needs 15 or more survivors to analyse, so the committed 2.3 suite checks outcomes only: 100 % coverage, but 61 % mutation score with 44 survivors. The stronger assertions are added in step 2.8 to kill them. | Jaweria: pending | S2 |
| 24 | 2026-11-28 | Mohsin | Sections 2.4 and 2.5: OpenAPI spec, data generator, API tests | `tests/team/api/openapi.yaml`; `generator/generate.mjs` (EP classes and 3-point BVA from the spec, one changed input per case, 90 cases); demo of two changed constraints (`demo/`); API suites `ep-bva`, `rules-state`, `br3-boundary` (115 tests); API coverage report; CI job `system-tests`; `docs/section-2-4-…`, `docs/section-2-5-…` | First run: 50 of 90 generated cases failed. The AI separated real baseline differences from its own test mistakes: the edit cases first used an empty base body, so D3 masked them. The base now carries a valid value for every field. A false failure from the BR-3 cap led to a reset before every suite. The AI found D6 (concurrent approvals create two work orders) and confirmed it was intermittent (1 of 5 tries) before filing it. Mohsin checks the spec constraints against Section 1 and can run the change-two-constraints demo live. | Mohsin: pending | S2 |
| 25 | 2026-11-28 | Jaweria, Mohsin, Aun | Section 2.6: six use cases with Playwright tests, two per member | `docs/section-2-6-use-cases.md`; `tests/team/e2e/` (30 flows: main, 2 alternative and 2 exception flows per use case; UC-1 and UC-2 Jaweria, UC-3 and UC-4 Mohsin, UC-5 and UC-6 Aun); Playwright added to the CI `system-tests` job | Before writing the tests, the AI explored the live UI with Playwright to find the real controls (the button is "+ Request", not "Add Request"; Feedback dialog; Edit icon). First full run: 6 failures, all from HTTP 429 on the login page (the anonymous rate limit). The AI changed the tests to sign each user in once through the API and inject the session; logging in is not part of any use case. Final run: 30 flows, 29 pass, and UC1-E2 is an expected failure documenting D2. Each member reads their two use cases and can explain every flow and assertion. | Jaweria: pending; Mohsin: pending; Aun: pending | S2 |
| 26 | 2026-11-28 | Mohsin | Section 2.7 (part 1): defects filed as GitHub Issues | Labels for type, severity, priority, status, triage decision and category; issues #6–#19 (D1–D6, W1–W8), each with steps to reproduce, expected vs actual, evidence and triage reason; issue numbers added to the known-defect list | The AI proposed the severity, priority and triage decision for each issue from the risk register and the impact. Mohsin reviews them as defect lead and changes any he disagrees with. | Mohsin: pending | S2 |
| 27 | 2026-11-28 | Mohsin | Section 2.7 (part 2): root-cause analysis and Pareto | `docs/section-2-7-defects.md` (defect log, 5 Whys and fishbone for D1 and D6, corrective and preventive actions, GQM metrics); `tests/team/defects/pareto.mjs` (reads the issues, writes `docs/evidence/defects/pareto.svg`) | Each 'why' was checked in the code or schema before it was written: no `@Version` on `Request`; only a foreign key, no unique constraint, on `work_order.parent_request_id`; the date of the cancellation-reason changelog. The AI first wrote an in-scope size of 1,349 lines without measuring; it was corrected to 2,508 from SonarQube's per-file `ncloc`, so the defect density is 5.6 per KLOC. Mohsin redraws the two fishbones by hand for the viva. | Mohsin: pending | S2 |
| 28 | 2026-11-28 | Jaweria | Section 2.8 (part 1): surviving-mutant analysis, stronger tests, mutation threshold | `docs/section-2-8-mutation-and-ci.md` (44 survivors classified: 35 weak assertion, 9 missing test, 0 equivalent; quality-gate thresholds justified); stronger side-effect assertions plus 9 new checks (sanitiser, `em.refresh`, webhooks, portal company); `mutationThreshold` 80 (EX-3) | The stronger assertions were the AI's first version from step 2.3, kept aside so that 2.3 could show the survivors honestly. The AI checked candidate equivalent mutants (#14, #24, #25, #43) and found each observable. Result: 113/113 killed (100 %), coverage still 100 %. Jaweria can explain why coverage stayed at 100 % while the score went from 61 % to 100 %. | Jaweria: pending | S2 |

## Not used

- **Screenshots.** No screenshot taken by the AI is used as evidence (teacher's rule). Members capture every screenshot themselves.
- **Scratch runs.** Outputs from the feasibility runs (row 11) stay outside the repository. Each tool is re-run by its owner for the real evidence.

## Prompts by row

These are the prompts behind each row, quoted as typed (typos kept). Where part of a prompt is not about the row, it is left out and marked […]. Email addresses are redacted because the repository is public.
Long pasted blocks are summarised, except the teacher's announcement, which is quoted in full. A prompt that served several rows is quoted once; later rows refer back to it.
Prompts not tied to any row (for example, git housekeeping) are not listed here. Every prompt, and every reply, is kept in the session transcripts named under "Prompts" above.

### Row 1 — Earlier candidate system (NEMO)

**S0-1** · 2026-11-25 16:12 UTC

> read @SQE_Final_Project Fall 2026.pdf top to bottm, left to right and figure out if everythign has been implemented perfectly here or not and where do i have to go next

### Row 2 — Is Atlas CMMS suitable, and does it count as an MIS?

**S1-1** · 2026-11-25 17:36 UTC

> read @"SQE_Final_Project Fall 2026.pdf" and tell me if this repo is suitable and also qualifies as an MIS: https://github.com/Jaweria-Abdul-Hameed/SE3002-Project.git

**S2-1** · 2026-11-25 17:37 UTC

> read @"SQE_Final_Project Fall 2026.pdf" and lmk if this repo is suitable for the given requriemnts and technologies and qualifies as an MIS: https://github.com/Grashjs/cmms

**S2-2** · 2026-11-25 17:43 UTC

> so mutation cant be tested with the provided tools>

**S2-3** · 2026-11-25 17:45 UTC

> based on what the pdf says is 1 an acceptatble way over a source-lebel mutation script

**S2-4** · 2026-11-25 17:47 UTC

> id go with the first option

### Row 3 — Check our own draft analysis

**S2-5** · 2026-11-25 17:51 UTC

> also based on what you said regarding the project ive analysed a couple of things -- lmk if they are workable for this project:
>
>
> [pasted: draft registration and analysis of Atlas CMMS produced in session S1, about 3,200 characters; full text in the transcript]
>
>
> also clone Atlas CMMS in this folder and connect it to this repo and push it there https://github.com/Jaweria-Abdul-Hameed/SE3002-Project.git
> this is the repo where we will work and push all the tesitng and have our rentire CI and tests run, and set up Git rep and scaffold plugin module

### Row 4 — Set up the repository

- Same prompt as **S2-5** above.

### Row 5 — Custom mutation operators

- Same prompt as **S2-4** above.

- Same prompt as **S2-5** above.

### Row 6 — Licence and free-tier caps

**S2-6** · 2026-11-25 18:08 UTC

> alright alright -- hold your horses now -- we will go step by step doing each part of teh poject -- not radnome things from the middle -- first of all let me know 2 things -- 1) is this repo paid -- like i think there is a 5 user rule, etc -- this is my convo with another claude agent: 
>
> [pasted: a conversation from session S1 about the commercial licence and free use, about 3,700 characters; full text in the transcript]
>
> […]

### Row 8 — Run the app locally; explain the workflows' UI

**S2-14** · 2026-11-25 18:30 UTC

> alright so we are three gorup memebers:
> 1) Jaweria Abdul Hameed, username: Jaweria-Abdul-Hameed, [email redacted]
> 2) Mohsin Khan, username: mohsinkhandevs, [email redacted]
> 3) Muhammad Aun, username: m-aun-005, [email redacted]
>
> what are the areas -- suggest an assignment
> […]
> also before we begin -- run this project by donwloading whatver needed locally and give me instructions on hwo to use the ui of the part that we will be testing -- the workflows

### Row 9 — Area split

- Same prompt as **S2-14** above.

**S2-22** · 2026-11-26 16:28 UTC

> 1. The app limits how often it can be called. Each logged-in account gets 100 requests a minute. When 5 simulated users shared one account, 99.4% of requests failed with 429 "Too many requests". Not logged in, each IP gets 20 requests a minute and 80 an hour.
>    - Fix: give each simulated user its own Requester account (free and unlimited), and reuse login tokens in the test suites.
>    - The limits can be changed through the RATE_LIMIT_* settings without editing code.
>
> are we chnaging the oce for this? Also your above analysis proves its feasible and we cna possibly start right -- resend the split so i can confirm and approve the split

**S2-23** · 2026-11-26 16:31 UTC

> yes i approve -- just one thing -- the 2 automated use cases, etc -- you can do that right

### Row 10 — Do the free-tier limits affect our runs and the viva?

**S2-16** · 2026-11-26 03:49 UTC

> tell me again -- will the free software limits affect our runs and the viva

**S2-17** · 2026-11-26 04:48 UTC

> but didnt you mentio that the workflows we were testing are the least affected by it

**S2-18** · 2026-11-26 04:51 UTC

> will it be valid for this project?

**S2-19** · 2026-11-26 04:53 UTC

> no but will this null our project if were usign a project with 2 licenses -- the free one a little restricitng

**S2-20** · 2026-11-26 04:55 UTC

> does erpnext calso behavle like this --

### Row 11 — Prove every section is feasible

**S2-21** · 2026-11-26 04:57 UTC

> wait so the part of the users -- k6 -- will we even be able to do that -- i just wnat to ensure that each section and part of the projetc can be done on this repo without hitches for it to qualify -- i want nothing ambiguous -- actual concrete results

- Same prompt as **S2-22** above.

### Row 12 — Check our Google Sheet registration

**S2-24** · 2026-11-26 16:36 UTC

> go ahead with section 1, btw this is what i wrote in my google sheet for the project registartion -- evaluate if its correct or not - alongside my teacher said that :
>
>
> [pasted: the teacher's announcement, quoted in full below]
>
>
> keep these in mind

> **Pasted teacher announcement:**
>
> MPORTANT ANNOUNCEMENT – SQE PROJECT SUBMISSION & EVALUATION
> Please carefully note the following instructions:
>
> (1) AI USAGE AND UNDERSTANDING
> AI usage is permitted. However, if any component is identified as AI-generated and you are unable to explain or justify the relevant work during evaluation, ZERO MARKS will be awarded for that component, regardless of the submitted code or documentation.
>
> (2) SCREENSHOT REQUIREMENTS
> Wherever screenshots are required, you must perform the task yourself and capture the actual results. AI-generated screenshots or screenshots obtained through an AI agent performing the task on your behalf will result in ZERO MARKS for the corresponding requirement.
>
> (3) PLAGIARISM
> All submissions will be checked for plagiarism. Identical or substantially similar content, analysis, or justifications without legitimate reasoning will be treated as plagiarism.
> Claiming independent AI generation, even with AI chat history as evidence, will NOT be accepted as an excuse.
> Plagiarism in even a single component will result in ZERO MARKS FOR THE ENTIRE PROJECT, at the very least. Further disciplinary action may be taken depending on the extent of plagiarism.
>
> (4) SUBMISSION DEADLINE
> Late submissions will NOT be accepted. No extensions or excuses will be entertained.
>
> (5) PROJECT DEMONSTRATIONS
> Project demos will be held next week. Students must be prepared to explain and defend every aspect of their submitted work. No excuses will be accepted.
>
> REMINDER: Permission to use AI does NOT mean permission to outsource your project to AI.
> NOTE: Students are NOT required to make any submissions on Turnitin. However, all submissions will still be checked for plagiarism.
>
> Best regards

**S2-25** · 2026-11-26 16:44 UTC

> so far no other section or person has registered atlas:
> Atlas CMMS (Java Spring Boot + React, PostgreSQL, AGPL-3.0): an open-source computerised maintenance management information system. Module: Maintenance Requests → Work Orders. Workflow 1 (Submit Request): a Requester submits a maintenance request for an asset (POST /requests), which is saved as pending. Workflow 2 (Review Request): an Admin approves the request, which creates a linked Work Order with status OPEN (PATCH /requests/{id}/approve), or cancels it with a reason (PATCH /requests/{id}/cancel). Shared record: the Request (its approval state, cancellation reason and linked work order). Roles: Admin vs Requester.

### Row 13 — Seed and reset scripts

- Same prompt as **S2-24** above.

### Row 14 — Teacher's announcement: screenshots and AI use

- Same prompt as **S2-24** above.

### Row 15 — From Markdown to the final PDF

**S2-26** · 2026-11-26 16:46 UTC

> btw -- rn youve completed section 1 in an md -- will this be convereted to pdf or soemthing with other sectiosn fro final submission

### Row 16 — Section 1

- Same prompt as **S2-24** above.

**S2-27** · 2026-11-27 10:45 UTC

> alright ive reviewed -- before anythign answer here in chat -- what is the difference between the limited admin and admin -- like it mentions no settigns as a permission -- but settings for what the org or what -- otherwise i think its good for our project becasue it even given us an infeasible unreachable condition int he boolean condition -- do not edit anything

**S2-28** · 2026-11-27 10:50 UTC

> btw i also think -- the test scope we've defined as in-scope could also have file numbers and names added to it -- also this thing you just mentioend regarding the ui boolean condition 00 should we mention it in our doc as a business rule or a business rule is just somethign the api checks -- does the api have the one with only 2 conditions or 3

**S2-29** · 2026-11-27 10:53 UTC

> yes

**S2-30** · 2026-11-27 10:59 UTC

> couple questions -- i was just reviewing the section 1 file -- can see the edits otherwise in the md but the preview for the md still shows the previous one, secondly, ive doen the sheet fix, thrd are you mainting an ai use record

### Row 17 — This record

- Same prompt as **S2-30** above.

**S2-31** · 2026-11-27 11:01 UTC

> yes -- and you also know what edits ive been asking you to make and chnages ive wnated to make as i reviewed

**S2-33** · 2026-11-27 11:09 UTC

> add the prompts in a separate section of this same doc correcponsong to the rows in the table

### Row 18 — CI gate and pull requests

**S2-8** · 2026-11-25 18:14 UTC

> alright -- and what about the prs -- will i need them for the ci gate all the time or can they be created and assigned or something

**S2-9** · 2026-11-25 18:18 UTC

> what does teh pdf say regarding the ci gate and prs

### Row 19 — Keep project context between sessions

**S2-15** · 2026-11-25 20:41 UTC

> remember everything -- ill look at it after waking up

### Row 20 — Section 2.1: SonarQube and cyclomatic complexity

**S2-36** · 2026-11-27 11:23 UTC

> lets begin with section 2

### Row 21 — CI quality gate built early

**S2-40** · 2026-11-27 12:10 UTC

> but dont we have to have a ci gate for this -- doesnt the doc say that every action including sonarqube should be a github action

**S2-41** · 2026-11-27 12:12 UTC

> Ci skeleton earlier -- but rn were waiting for the sonarqube run in my terminal to finish via maven -- also for 2.2 -- its 27nov 5 11 pm and i plan to finish till part 5 tonight or early moring till 2 - 3 am on 28 nnov and submission is 11 59 pm 29 nov

### Row 22 — Section 2.2: plan, risks, traceability

- Same prompt as **S2-41** above.

### Row 21 (continued) — merge, branch protection, CI fixes

**S2-42** · 2026-11-27 12:37 UTC

> merge PR 1 and set up branch protection -- set up ci properly ensuring no issues and then i will move to taking the ss for sonarqube myself and making the cyclomatic graphy by hand

### Row 23 — Section 2.3: unit tests

**S2-44** · 2026-11-28 09:24 UTC

> how about we complete section 2 -- and then from start to end you tell me what i need to do -- like ss and the other things like drawing the things by hand or what not
