---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain (skipped — low complexity, general domain)
  - step-06-innovation (skipped — no genuine innovation signals; differentiator captured in Executive Summary)
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
releaseMode: single-release
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
workflowType: 'prd'
---

# Product Requirements Document - bmad-todo

**Author:** Aman
**Date:** 2026-04-27

## Executive Summary

**bmad-todo** is a deliberately minimal full-stack todo web application built as an internal learning exercise. The running app — single-user, no-auth CRUD on todos, Dockerized for local execution — is the *proof point*; the *deliverable being validated* is the planning artifact chain (the product brief, this PRD, the epics and stories, the architecture document) and a downstream dev team's ability to execute it without escalation.

The product targets two distinct users: the **developer team executing the build** (primary — judges artifact quality through their need to ask for clarification or not), and the **single individual using the running todo app** (secondary — a developer managing personal tasks locally). Aman is the sole project sponsor and the sole judge of success.

The core problem is process-level, not user-level: BMad planning artifacts must be unambiguous enough to execute, while leaving genuine architectural decisions to the architect. The todo domain is incidental — chosen precisely because it is well-understood, isolating artifact quality as the experimental variable.

### What Makes This Special

The differentiator is **honest scope discipline**. The brief refuses to fabricate market positioning, sets the UX bar at "doesn't look broken," and explicitly separates v1 scope from architecturally non-foreclosed future capabilities (multi-user/auth, per-todo metadata, real-time sync, audit log) without requiring v1 to implement them. The technical inputs are **stakeholder-imposed constraints, not architectural prescriptions** — Fastify, React, Docker, env-driven config, backend health checks are fixed by the sponsor; persistence technology, module structure, API shape, and all other design choices remain the architect's call. This separation is the calibration test: can the workflow produce artifacts that respect the boundary between *constraints inherited* and *decisions still owned*?

## Project Classification

- **Project Type:** `web_app` — single-page React frontend, REST/HTTP backend (Fastify, Node.js), browser-delivered, runs locally in Docker.
- **Domain:** `general` — personal task management, no regulated-industry concerns, no compliance burden.
- **Complexity:** `low` — single entity (todo), single user, no auth, no real-time, deliberately minimal v1 scope. Architectural non-foreclosure adds *future* surface area without adding *v1* complexity.
- **Project Context:** `greenfield` — empty repository, no legacy systems, no migration concerns.

## Success Criteria

Success for **bmad-todo** is judged at two layers — both must hold. There are no business or commercial metrics; this is a non-commercial learning exercise with Aman as sole judge.

### User Success

Two distinct user populations, two distinct success bars.

**Primary user — the developer team executing the build:**

- The dev team takes this PRD plus the downstream epics-and-stories list and architecture document and reaches a working app **without raising clarification questions on scope, requirements, or acceptance criteria.**
- Architectural decisions made downstream by Winston (architect) trace cleanly to constraints in the brief or PRD — no surprises, no "where did this come from?" moments.
- The boundary between *v1 scope* and *architecturally non-foreclosed future* is unambiguous to the architect when designing.

**Secondary user — the end user of the running app:**

- A first-time user can perform create / view / mark-complete / delete on todos **without onboarding, tutorial, or instructions.**
- Created todos persist across browser refreshes and across container restarts (`docker compose down && docker compose up` does not destroy data).
- The user perceives the app as functional on both desktop and mobile viewport sizes — no obviously broken layouts, overflowing elements, or unreachable controls.

### Business Success

**Not applicable.** This is a learning exercise, not a commercial product. There are no revenue targets, no DAU/MAU goals, no growth metrics, no adoption KPIs. The project sponsor's win condition is captured under *Process Success* below.

### Process Success

The project-sponsor success metric, replacing Business Success for this non-commercial engagement.

- The artifact chain (brief → PRD → epics/stories → architecture) is judged ready-to-execute by Aman without rework rounds beyond minor edits.
- The boundary between **stakeholder-imposed constraints** (Fastify, React, Docker, env config, health checks) and **architect-owned decisions** (persistence, module structure, API shape, etc.) is respected throughout — neither the PRD nor the architect's output crosses that line in the wrong direction.

### Technical Success

- Application starts cleanly via a single `docker compose up` on a fresh machine, given only environment variables.
- Backend exposes a documented HTTP API supporting CRUD on todos with consistent shape and predictable error responses.
- Backend exposes health-check endpoint(s) reporting accurate status (including persistence-layer health if applicable).
- Frontend renders empty / loading / error states without visible breakage.
- Persistence survives container restarts (data durability).
- Architecture document explicitly addresses how non-foreclosed capabilities (multi-user/auth, per-todo metadata, real-time sync, audit log) can be added without ground-up rewrite.
- **Per-service Dockerfiles** are present in the repo, and `docker compose up` brings the full app up end-to-end with no bespoke orchestration steps.
- **Code coverage ≥ 70%** meaningful coverage (excluding generated code, type definitions, configuration scaffolding) reported by the backend and frontend test runners.
- **End-to-end verification:** ≥ 5 passing Playwright tests covering core user flows (create todo, list todos, mark complete, mark incomplete, delete).
- **Accessibility:** WCAG 2.2 Level A conformance, verified by an automated accessibility scanner (axe-core or equivalent) reporting zero violations at the Level A success-criteria scope.

### Measurable Outcomes

| # | Outcome | Measurement |
|---|---------|-------------|
| 1 | Dev team executes without clarification | Zero clarification questions raised that the PRD or architecture doc could have answered |
| 2 | App runs end-to-end on fresh machine | `docker compose up` succeeds on a Docker-only machine with a populated `.env` file; per-service Dockerfiles present |
| 3 | Data durability | After `docker compose down && docker compose up`, previously created todos are still present |
| 4 | Health reporting | Health endpoint returns 200/healthy when persistence is up; non-200 or unhealthy when persistence is down |
| 5 | Core CRUD without instruction | First-time user completes create / view / complete / delete without consulting documentation |
| 6 | Responsive at standard viewports | App renders without breakage at desktop (≥1024px) and mobile (≥360px) widths |
| 7 | Architectural non-foreclosure | Architecture doc contains a section explicitly addressing each of: auth, per-todo metadata, real-time sync, audit log |
| 8 | Code coverage ≥ 70% | Test runner coverage report (meaningful coverage; excludes generated/scaffold code) |
| 9 | E2E coverage ≥ 5 Playwright tests, all passing | Playwright run output (CI integration TBD — pass/fail measured wherever the suite runs) |
| 10 | WCAG 2.2 Level A conformance | Automated scanner (axe-core or equivalent) reports zero violations at Level A scope |

### Explicitly Out of Scope as Success Metrics

Performance benchmarks; browser-matrix coverage beyond modern evergreen browsers; user-research validation; analytics; uptime SLOs; **accessibility commitments beyond WCAG 2.2 Level A** (AA, AAA, manual screen-reader audits, color-contrast at moderate severity remain out of scope); security audit; load/stress testing.

## Product Scope

The standard MVP / Growth / Vision tiering is *partially applicable here* — this is a learning exercise with no planned v2. The structure is used honestly: MVP is what gets built; Growth captures the non-foreclosure list as *architectural readiness*, not features to build; Vision is explicitly empty.

### MVP — Minimum Viable Product

Everything needed for the app to satisfy the *Product-layer* and *Technical Success* criteria above:

- **Todo entity:** short text description, completion status, creation timestamp.
- **CRUD operations:** create, list, mark complete/incomplete, delete.
- **Single-user, no authentication.** All todos belong to "the user."
- **Persistent storage** that survives container restarts (technology = architect's call).
- **Backend:** Fastify (Node.js) exposing a small REST API and health-check endpoint(s).
- **Frontend:** React SPA, responsive desktop + mobile, with empty / loading / error states.
- **Visual distinction** between completed and active todos.
- **Graceful error handling** on both client and server (no crashes, no raw stack traces in user-facing output).
- **Dockerized deployment:** per-service Dockerfiles, `docker compose up` brings up the full app, environment-driven configuration.
- **Code coverage ≥ 70%** meaningful (unit/integration tests on backend and frontend).
- **End-to-end tests:** ≥ 5 passing Playwright tests covering core user flows.
- **Accessibility:** WCAG 2.2 Level A conformance verified by automated scanner.
- **Documentation** sufficient for a developer to clone, configure, and run.

### Growth Features (Post-MVP) — Architectural Readiness Only

These are **not v1 features** and **will not be built**. They appear here only as the architectural non-foreclosure contract — the architecture document must demonstrate how each could be added without a ground-up rewrite:

- Multi-user with authentication.
- Per-todo metadata (priority, due date, tags).
- Real-time sync and collaboration.
- Audit log of todo changes.

Architecture must accommodate; product will not deliver. The architect *must* address these explicitly.

### Vision (Future)

**Empty by design.** There is no v2 of bmad-todo planned. The non-foreclosure list above exists to keep the *architectural exercise* honest, not because future features will actually be built. If the exercise succeeds, the *artifacts and workflow* graduate forward into harder problem domains; the todo app itself is archived.

## User Journeys

The end-user persona for v1 is a single individual managing personal tasks — per the brief, "effectively the developer running it locally." No fictional persona is required; the User is a real member of the dev team or Aman himself. Three journeys cover all genuine user-system interactions in v1.

### Journey 1 — First-time use (happy path)

**Opening scene.** The User boots the app for the first time after `docker compose up`. They open the browser to the configured URL.

**Rising action.** The page loads. The empty state is visible immediately — no spinner, no login screen, no onboarding tour. There's an input field for adding a todo and a clear visual cue that the list is empty (text such as "No todos yet" or equivalent — UX/architect call). The User types a task description and submits (Enter key or button).

**Climax.** The todo appears in the list immediately, marked as active. Visual treatment communicates "active." A second todo is added the same way. The User clicks the completion control on one of them; it visually changes state to "completed" — distinct from active. The User clicks delete on the other; it disappears.

**Resolution.** The User has a list with one completed todo. They close the browser tab, confident the app works. **No documentation was consulted.**

**Capabilities this journey requires:**

- Empty state on initial load (no auth gate, no onboarding).
- Add-todo input that's discoverable and submittable via keyboard or click.
- Immediate feedback when adding (perceived-instant rendering).
- Visual distinction between active and completed todos.
- Toggle-completion control on each todo.
- Delete control on each todo.
- All of the above accessible at desktop and mobile viewport widths without breakage.

### Journey 2 — Returning user (persistence verification)

**Opening scene.** The User comes back the next day. They had three todos from yesterday — two active, one completed. They run `docker compose up` (or it's already running), open the browser, and load the URL.

**Rising action.** The page renders. There's a brief loading state. Then the three todos appear in the same state they were left in.

**Climax.** The User marks one of the remaining active todos complete, then refreshes the browser. The todo is still marked complete. They run `docker compose down && docker compose up` from a terminal, reload the page, and the same three todos with the same states are still there.

**Resolution.** Trust established. The app is reliable. The User uses it as their actual personal todo tool from this point forward.

**Capabilities this journey requires:**

- Persistent storage that survives both page refresh and container restart.
- Read-on-load that reflects the true persisted state.
- Loading state that displays while data is being fetched (not a flash of empty state).
- Optimistic-vs-pessimistic update model is the architect's call, but the persisted state must be the source of truth on reload.

### Journey 3 — Failure path (graceful degradation)

**Opening scene.** The User has the app open. The backend container crashes, is restarted, has a transient network issue, or persistence is unavailable.

**Rising action.** The User attempts to add a new todo. The frontend submits the request. The backend doesn't respond, or returns a 5xx, or returns invalid data.

**Climax.** Instead of a blank screen or a raw stack trace, the frontend renders a clear **error state** — for example, "Couldn't save your todo. Try again." Existing todos remain visible (the page didn't crash). The User retries; this time the backend is healthy, and the todo saves successfully.

**Resolution.** The User trusts that the app fails visibly, doesn't lose data already shown, and recovers when the underlying issue clears. They don't need to know what went wrong technically.

**Capabilities this journey requires:**

- Frontend error state for failed mutations (add, update, delete).
- Frontend error state for failed initial load (distinct from empty state).
- Errors don't crash the app or destroy already-rendered data.
- Backend returns consistent error response shape for predictable frontend handling.
- Retry is possible without page reload.

### Journeys Explicitly Not Mapped

Documented here so a future reader can verify the omissions are deliberate, not oversight.

| Hypothetical journey | Why omitted |
|---|---|
| Admin / Operations | No admin user exists. Single-user, no roles. |
| Support / Troubleshooting | No support function. Local-only deployment; the User is also the operator. |
| API consumer | The React frontend is the only API consumer. Mapping a separate "API consumer" journey would invent a user that doesn't exist in v1. |
| Multi-user / collaboration | Out of v1 scope; non-foreclosed at the architectural level only. |
| Authentication / login | Out of v1 scope; non-foreclosed at the architectural level only. |
| Mobile-app-specific flows (push, deep links) | Web app, not native. Mobile = responsive web. |

### Journey Requirements Summary

The three journeys collectively reveal the following capability areas, which feed the Functional Requirements section that follows:

- **Read:** list todos with their states; render empty / loading / loaded / error states distinctly.
- **Create:** add a todo with text description; immediate feedback.
- **Update:** toggle completion state on a todo.
- **Delete:** remove a todo.
- **Persistence:** reads reflect persisted truth; writes survive refresh and container restart.
- **Error handling:** failed mutations and failed loads produce visible, recoverable error states without crashing or destroying visible data.
- **Health observability** (backend-only, not user-facing): health-check endpoint reflects persistence-layer status.
- **Responsive layout:** all of the above functional at desktop (≥1024px) and mobile (≥360px) viewport widths.

## Web Application Specific Requirements

### Project-Type Overview

bmad-todo is a single-page web application (SPA) delivered via a React frontend communicating with a Fastify HTTP backend, both running in containers orchestrated by Docker Compose on a developer's local machine. There is no public deployment, no CDN, no edge layer, and no service mesh. The browser is the only client.

### Technical Architecture Considerations

- **Frontend rendering model:** Client-side rendered SPA expected. Server-side rendering, static generation, and multi-page routing are not required and should not be introduced unless the architect identifies a constraint that demands them.
- **API style:** REST/HTTP over JSON. Endpoint and resource shape are the architect's call within the CRUD scope defined in *User Journeys → Capability Areas*.
- **State management:** Frontend state management library is the architect's call. Constraint: frontend must reflect persisted backend state on reload (no client-only state masquerading as persistence).
- **No service worker / PWA features.** Out of scope.
- **No web sockets or server-sent events.** Real-time is non-foreclosed at the architectural level only.

### Browser Support Matrix

| Browser | Versions supported | Notes |
|---|---|---|
| Chrome | Latest 2 stable | Primary dev target |
| Firefox | Latest 2 stable | |
| Safari | Latest 2 stable | Includes mobile Safari for responsive testing |
| Edge | Latest 2 stable | Chromium-based only |

**Out of scope:** Internet Explorer (any version), legacy Edge (EdgeHTML), Opera, browser-specific extensions or vendor-prefixed features beyond what build tools auto-handle, mobile browsers other than Safari iOS / Chrome Android (which are covered by the Latest 2 commitment).

### Responsive Design

- **Desktop floor:** ≥ 1024px viewport width — must render and function without breakage.
- **Mobile floor:** ≥ 360px viewport width — must render and function without breakage.
- **Tablet:** No specific commitment; whatever falls out of the desktop/mobile range working naturally is acceptable.
- **Orientation:** Both portrait and landscape on mobile must be functional.
- **Touch targets:** No specific minimum size committed for v1. Architect/UX may choose to follow standard guidance (e.g., 44×44 CSS px) but it is not a measured success criterion. The "doesn't look broken" UX bar applies.
- **Layout strategy:** Architect's call (CSS Grid, Flexbox, container queries, breakpoint-based media queries — all acceptable).

### Performance Targets

The brief states interactions should "feel instantaneous under normal conditions." Performance benchmarks are explicitly out of scope as success metrics. The PRD therefore commits to the following *qualitative* targets, not measured ones:

- **Perceived-instant on local Docker:** Add, toggle-complete, and delete actions complete fast enough that the user does not perceive a wait under normal local-Docker conditions on a developer machine.
- **Initial load:** A reasonable initial page load under local conditions; no specific FCP / LCP targets.
- **No formal latency budget** (no p50 / p95 / p99 commitments).
- **No load-testing requirement.** The app is designed for single-user local use.

If these qualitative targets fail under reasonable test conditions, the architect should investigate and recommend remediation, but no specific numeric SLO governs v1.

### SEO Strategy

**Not applicable.** The application is local-only, single-user, and has no public-internet presence. No meta tags, no sitemap, no canonical URLs, no structured data, no Open Graph tags are required. The HTML `<title>` should be sensible (e.g., "bmad-todo") for browser-tab usability, but that is a UX courtesy, not an SEO commitment.

### Accessibility Level

- **Conformance target:** WCAG 2.2 Level A.
- **Verification method:** Automated accessibility scanner (axe-core or equivalent) integrated into the test pipeline. Zero violations at Level A success-criteria scope is the success bar.
- **Out of scope:** Level AA / AAA conformance, manual screen-reader audits, color-contrast review beyond Level A, keyboard-only walkthroughs beyond what automated scanners cover, accessibility statement / VPAT documentation.
- **Implication for design:** The "doesn't look broken" UX bar is preserved. Level A does not require visible focus rings, sufficient color contrast, or other Level-AA-style visual commitments — it requires the app to be *usable with assistive tech* (alt text where needed, keyboard reachability, page title, no keyboard traps, etc.).

### Implementation Considerations

- **Build & bundling:** Frontend build tooling (Vite, webpack, esbuild, Parcel, etc.) is the architect's call.
- **CSS approach:** CSS modules, plain CSS, CSS-in-JS, Tailwind, vanilla-extract — all acceptable. Architect's call.
- **Frontend testing:** The 70% coverage target applies to the frontend codebase as well as backend. Test runner is the architect's call (Vitest, Jest, etc.). Component testing approach is the architect's call.
- **Bundle-size budget:** None committed. Local-only deployment means bundle size has minimal practical impact.
- **Browser DevTools / source maps:** Source maps should be available in the development build. Production-build source-map handling is the architect's call.

## Release Strategy & Risk Mitigation

### Strategy & Philosophy

- **Release mode:** Single release. No phasing. v1 is the only release planned.
- **Approach:** *Problem-solving MVP* — every feature in scope exists to satisfy a specific item in *Success Criteria → Technical Success* or *User Success*. Nothing is included for engagement, growth, monetization, or platform-extension reasons.
- **Resource model:** Open-ended timeline; quality and discipline over speed. Team size assumed to be small (1–3 developers, potentially Claude-assisted). Effort budget is not committed in this PRD.
- **Tier handling:** Every must-have for v1 is enumerated in *Product Scope → MVP*. There is **no nice-to-have tier** — anything not on the MVP list is either non-foreclosed-only (architectural readiness) or fully out of scope. If the dev team hits a wall mid-execution, they should escalate via `bmad-correct-course` rather than silently de-scope.

### Risk Mitigation

**Technical Risks**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Architect's persistence choice creates downstream rework if the database tech is mismatched to non-foreclosure goals (e.g. a flat-file store that can't accommodate auth/audit-log) | Medium | Medium | Architecture document must justify persistence choice against the four non-foreclosed capabilities explicitly. Reviewable before stories are written. |
| 70% coverage target met by trivial tests (high coverage, low signal) | Medium | Medium | "Meaningful coverage" qualifier in the success criterion. Test review by Murat (Test Architect persona) before sign-off. |
| WCAG 2.2 Level A automated scan misses real accessibility issues that manual review would catch | Medium | Low | Accepted risk. Brief explicitly excluded manual screen-reader audits and color-contrast review. The "doesn't look broken" UX bar is the explicit fallback. |
| Playwright test scope underspecified — "5 passing tests" satisfied by trivial tests that don't cover real flows | Medium | Medium | Acceptance criterion in epics/stories must specify *which user flows* the Playwright tests cover (create, list, complete, incomplete, delete) — quantity alone is not the bar. |
| Container orchestration choice (compose-only vs. anything more) creates portability issues | Low | Low | Brief commits to `docker compose up` end-to-end. Architect must hit that target. |

**Market Risks**

**Not applicable.** Non-commercial learning exercise. There is no market, no users to lose, no competitive pressure, no product-market fit to validate.

**Execution Risks (replaces "Resource Risks" for this engagement)**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dev team raises clarification questions the PRD or architecture should have answered (this is the *primary* failure mode for the exercise) | Medium | High — directly fails the project | Implementation-readiness check (`bmad-check-implementation-readiness`) before handoff to dev. PRD validation (`bmad-validate-prd`) before that. |
| Mid-execution scope drift — dev team adds polish or features not in scope | Low | Medium | Out-of-scope list in brief and PRD is explicit and falsifiable. `bmad-correct-course` available if drift is discovered. |
| Architect over-engineers for non-foreclosure (e.g. introducing event sourcing now to "prepare" for audit log) | Medium | Medium | Non-foreclosure is "must not require ground-up rewrite" — explicitly *not* "must implement now." Architecture doc must demonstrate the path, not pre-build it. |
| Open Question 5 (E2E + CI) is left unresolved at handoff and surfaces during dev | High | Low | Acknowledged. The PRD commits Playwright + ≥5 tests; CI integration remains TBD and will be surfaced again at the architecture/test-design stage. Not a blocker for dev to start. |

## Functional Requirements

This section is the **binding capability contract** for v1. UX design, architecture, and story breakdown will support only what is listed here. A capability not listed here will not exist in v1 unless explicitly added.

A few FRs (FR21–23) describe system capabilities that are *also* stakeholder-imposed constraints from the brief. They are listed as FRs because they form part of the binding contract, even though the underlying technology was fixed by the sponsor rather than chosen by the architect.

### Todo Management

- **FR1:** User can create a todo by providing a text description.
- **FR2:** User can view the complete list of todos.
- **FR3:** User can mark an active todo as completed.
- **FR4:** User can mark a completed todo as active (un-complete it).
- **FR5:** User can delete a todo, removing it permanently from the list.

### Todo State Visualization

- **FR6:** User can visually distinguish completed todos from active todos at a glance.
- **FR7:** User can read the full text description of each todo in the list.

### Application Lifecycle States

- **FR8:** User sees an empty-state indication when no todos exist.
- **FR9:** User sees a loading-state indication while todos are being fetched on initial load.
- **FR10:** User sees a clear error-state indication when the application cannot load or save data, without losing visibility of any todos already rendered.
- **FR11:** User can retry a failed action (load, create, complete / un-complete, delete) without reloading the page.

### Persistence & Continuity

- **FR12:** System persists each todo such that it survives a browser refresh.
- **FR13:** System persists each todo such that it survives a container restart (`docker compose down && docker compose up`).
- **FR14:** System reflects the persisted state on each new load — no client-only state may masquerade as persisted data.

### Operational Health

- **FR15:** System exposes a backend health-check endpoint that reports overall service health.
- **FR16:** System's health-check endpoint reflects persistence-layer health when a persistence layer exists — an unhealthy persistence layer must produce an unhealthy health-check response.

### Responsive Presentation

- **FR17:** User can perform every functional capability at desktop viewport widths (≥ 1024 px) without layout breakage or unreachable controls.
- **FR18:** User can perform every functional capability at mobile viewport widths (≥ 360 px), in both portrait and landscape orientation, without layout breakage or unreachable controls.

### Accessibility

- **FR19:** User can interact with every functional capability (create, view, complete, un-complete, delete) using keyboard alone — no capability is reachable only via pointer device.
- **FR20:** User can navigate the application with assistive technology consistent with WCAG 2.2 Level A (page title present, no keyboard traps, semantic HTML / ARIA where required, alt text where applicable).

### Configuration & Deployment

- **FR21:** System reads runtime configuration from environment variables — no hard-coded URLs, ports, or secrets in source.
- **FR22:** System provides per-service Dockerfiles enabling each service to be built independently.
- **FR23:** System provides a `docker compose` configuration that brings up the full application end-to-end with a single command.

### Items Deliberately Not Made FRs

Recorded for traceability so a future reader can verify omissions are intentional, not oversights:

| Item | Where it lives instead |
|---|---|
| 70% meaningful code coverage | NFR (next section) — quality attribute |
| ≥ 5 Playwright E2E tests | NFR — quality attribute |
| Zero critical / Level-A WCAG violations | NFR — measurement bar for FR20 |
| "Perceived-instant" responsiveness | NFR — quality attribute |
| Developer documentation (clone / configure / run) | Project deliverable, tracked in *Product Scope → MVP* |
| Auth, multi-user, real-time sync, audit log, per-todo metadata | Out of v1 scope; non-foreclosed at architecture level only |

## Non-Functional Requirements

NFRs are listed selectively — only categories that genuinely apply to a single-user, no-auth, local-only learning exercise. Scalability and Integration are deliberately omitted (no growth projections, no external systems).

### Performance

- **NFR1:** User-facing actions (create, toggle-complete, delete) feel perceived-instant under normal local-Docker conditions on a developer machine. No formal numeric latency budget (no p50 / p95 / p99 SLOs); the bar is qualitative.
- **NFR2:** Initial application load completes in a reasonable time on local conditions (no specific FCP / LCP target). If load takes long enough that a loading state is visibly displayed, that is acceptable provided FR9 is satisfied.

### Security

Baseline only. No authentication, no authorization, no sensitive data, no payments, no compliance regime. The bar is "no obvious footguns."

- **NFR3:** Application accepts no untrusted input that would be executed as code or rendered as raw HTML — todo text descriptions are safely rendered (no XSS).
- **NFR4:** Backend rejects malformed, oversized, or otherwise abusive requests with appropriate HTTP error responses rather than crashing.
- **NFR5:** No secrets, credentials, hostnames, or environment-specific configuration are committed to source. All such values are sourced from environment variables (per FR21).
- **NFR6:** Backend persistence is not directly exposed to the network — only the Fastify backend is reachable from the browser. The persistence layer (whatever the architect chooses) is reachable only from the backend container.
- **NFR7:** SQL injection and equivalent injection vulnerabilities are not present — all user input that reaches a query layer is parameterized or otherwise escaped according to the architect-chosen persistence library's conventions.

### Accessibility

- **NFR8:** Application reports zero violations at WCAG 2.2 Level A scope when scanned by an automated accessibility scanner (axe-core or equivalent) running against the rendered application.
- **NFR9:** All FR1–FR23 capabilities remain accessible via keyboard alone, with no keyboard traps, on the supported browser matrix.

### Reliability & Durability

- **NFR10:** Persisted todo data survives container restart (`docker compose down && docker compose up` does not destroy data).
- **NFR11:** Persisted todo data survives backend service restart independent of the persistence container (a backend crash and restart loses no data).
- **NFR12:** Frontend recovers gracefully from transient backend failures: displayed todos remain visible, errors are presented (per FR10), and retry succeeds when the backend recovers (per FR11).
- **NFR13:** Backend crashes do not corrupt the persistence layer — partial writes either complete atomically or are not persisted.

### Maintainability

The brief is explicit: "easy to understand, deploy, and extend by future developers." Operationalizing that:

- **NFR14:** Codebase follows a consistent style enforced by formatter and/or linter integrated into the test pipeline. Specific tooling is the architect's call.
- **NFR15:** Backend, frontend, and persistence concerns are separated such that any one of them can be replaced without rewriting the others — consistent with the four non-foreclosed architectural extensions.
- **NFR16:** A README or equivalent at the repo root documents how to clone, configure (`.env`), build, run via `docker compose up`, and run the test suite — sufficient for a developer unfamiliar with the project to clone, configure, and reach a successful `docker compose up` within 15 minutes on a machine with Docker pre-installed.
- **NFR17:** No "magic constants" embedded in source code where environment configuration is appropriate (URLs, ports, connection strings, feature toggles).

### Testability & Quality

- **NFR18:** Backend test coverage is ≥ 70% meaningful coverage (excluding generated code, type definitions, configuration scaffolding) reported by the backend test runner.
- **NFR19:** Frontend test coverage is ≥ 70% meaningful coverage (same exclusions) reported by the frontend test runner.
- **NFR20:** End-to-end test suite contains ≥ 5 Playwright tests, all passing, collectively covering the five core CRUD flows (create todo, list todos, mark complete, mark incomplete, delete todo). Quantity alone does not satisfy this — flow coverage is the bar.
- **NFR21:** Test suites are runnable via documented commands without manual setup beyond what `docker compose up` provides.

### Portability

- **NFR22:** Application runs on any host capable of running Docker Engine ≥ a version specified by the architect. No host-OS-specific dependencies (no native binaries assumed present on the host beyond Docker itself).
- **NFR23:** Application functions identically on Linux, macOS, and Windows hosts running Docker. Differences in volume-mount semantics across hosts are an accepted edge case the architect should flag if they materialize.
