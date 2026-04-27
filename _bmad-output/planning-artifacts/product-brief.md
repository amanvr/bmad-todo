# Product Brief: bmad-todo

> **Status:** Draft v1 — awaiting review
> **Author:** John (Product Manager) with Aman
> **Date:** 2026-04-27
> **Type:** Internal learning exercise (non-commercial)

---

## Executive Summary

**bmad-todo** is a deliberately minimal full-stack todo application built as a **learning exercise** for exercising the BMad planning-and-execution workflow end-to-end. The running app is a textbook CRUD problem; the *real* product being validated is the chain of planning artifacts — brief → PRD → epics → stories — and the developer experience of executing them without intervention.

The exercise is a success when a small dev team can pick up the artifacts produced from this brief, run them through the BMad development phase (architect → dev → test), and ship a working Dockerized todo app on a local machine **without coming back to ask clarifying questions**. The todo app proves the artifacts; the artifacts are the deliverable.

This brief is therefore optimized for **clarity, scope discipline, and downstream usability** rather than market positioning or commercial differentiation.

## The Problem

Planning artifacts in early-stage projects are usually one of two failure modes: too vague (devs interpret freely and misalign), or too prescriptive (devs become typists for the PM's design choices). The result is rework, scope creep, and a "wait, what did you mean by X?" feedback loop that erodes both delivery speed and team trust.

This exercise validates whether a disciplined BMad workflow — guided brief, structured PRD, sharded epics/stories — produces artifacts of sufficient quality that a downstream dev team can execute autonomously on a non-trivial-but-bounded problem (a full-stack app with real persistence, real UI, real tests).

The "pain" being addressed is therefore **process-level**, not user-level. The todo-app domain is incidental — it was chosen precisely *because* it's well-understood, so any execution friction can be attributed to artifact quality rather than domain ambiguity.

## The Solution

A two-layered deliverable:

1. **The planning artifacts** — this brief, a refined PRD, a set of epics and user stories, and an architecture document — produced through the BMad workflow with John (PM), Sally (UX), Winston (Architect), and Murat (Test Architect) personas.

2. **The running application** — a full-stack todo app running on a developer's local machine, satisfying the constraints captured in *Stakeholder-Imposed Constraints* below (Dockerized, env-driven config, health checks) and the experience described next.

End-user experience of the app: open it, see your todos, add one, mark it complete, delete it. No accounts, no onboarding, no tutorial. Completed items are visually distinct from active ones. Works on desktop and mobile screen sizes. Empty / loading / error states exist and don't look broken.

That's it. The bar for the UX is "**doesn't look broken**" — not polished, not delightful, just unambiguously functional.

## What Makes This Different

This is a learning exercise, so there is no market moat to claim — and the brief should be honest about that. What makes this *engagement* different from "just build a todo app":

- **Process-first framing.** The artifacts produced are evaluated as first-class outputs, not as scaffolding to throw away.
- **Constrained inputs, open architecture.** Aman has fixed a small set of stakeholder constraints (see *Stakeholder-Imposed Constraints* below); persistence choice, module boundaries, and the rest of the design are explicitly the architect's. This separates the *constraints inherited* from the *decisions still owned* cleanly.
- **Forward-compatible scope.** v1 is single-user with no auth, but the architecture is required to leave the door open for multi-user/auth, per-todo metadata (priority, due date, tags), real-time sync/collaboration, and an audit log without a ground-up rewrite. Notifications and deadlines are *not* on this non-foreclosure list — out of scope and architecturally ignorable.

## Who This Serves

**Primary user — the developer team executing the build.**
A small group of developers (potentially Claude-assisted) who pick up the BMad artifacts and execute the development phase. Their need: artifacts unambiguous enough to execute without escalation, with enough context to make sound local decisions on details the PRD doesn't pin down.

**Secondary user — the end user of the todo app itself.**
A single individual (in v1, effectively *the developer running it locally*) managing personal tasks. Their need: open the app, get to work immediately, trust that their data persists across refreshes and container restarts.

**Stakeholder / decider — Aman.**
Sole judge of project success. Evaluates both the artifact chain (did the team need to ask?) and the running app (does it work, does it look not-broken, does it persist, does it run cleanly in Docker?).

## Success Criteria

Success is measured at two layers. Both must hold.

**Process-layer (the artifacts):**
- A development team can execute the PRD + epics + stories through to a running app **without requesting clarification on scope, requirements, or acceptance criteria**.
- Architecture decisions made downstream are traceable to constraints stated in the brief or PRD — no surprises.
- The boundary between "v1 scope" and "non-foreclosed future" is unambiguous to the architect.

**Product-layer (the running app):**
- A new user can perform create / view / complete / delete on todos without onboarding or instruction.
- Todos persist across page refreshes and across container restarts.
- The app runs end-to-end via `docker compose up` (or equivalent) on a fresh machine with no manual setup beyond environment variables.
- Health-check endpoints report accurate status for the backend (and persistence layer if applicable).
- Empty, loading, and error states render without visible breakage on desktop and mobile viewport sizes.

**Note on accessibility:** The PRD commits to **WCAG 2.2 Level A** conformance as a measurable success metric. This is the minimum real-conformance commitment — it does not raise the UX bar above "doesn't look broken," but it does require the application to be usable with assistive technologies (alt text, keyboard reachability, no keyboard traps, page titles, etc.). AA and AAA remain out of scope.

**Out of scope as success metrics:** performance benchmarks, browser-matrix coverage beyond modern evergreen browsers, user-research validation, analytics, uptime SLOs, accessibility commitments beyond WCAG 2.2 Level A.

## Scope

### In scope (v1)

- CRUD on todos: create, list, mark complete/incomplete, delete.
- Each todo: short text description, completion status, creation timestamp.
- Single-user, no authentication.
- Persistent storage that survives container restarts.
- Fastify backend exposing a small, well-defined REST API.
- React frontend with responsive layout for desktop and mobile.
- Visual distinction between completed and active todos.
- Empty, loading, and error states on the frontend.
- Server-side and client-side error handling that fails gracefully.
- Dockerized local deployment with environment-driven config.
- Backend health-check endpoint(s).

### Explicitly out of scope (v1)

- User accounts, authentication, authorization.
- Multi-user / collaboration / sharing / real-time sync.
- Task priorities, due dates, deadlines, reminders, notifications.
- Tags, categories, search, filtering, sorting beyond default order.
- Undo, keyboard shortcuts, animations, offline mode, PWA features.
- Cloud deployment, production hardening.
- Analytics, telemetry, observability beyond health checks.
- Performance benchmarks and browser-compatibility targets beyond modern evergreen browsers.
- Accessibility commitments **beyond WCAG 2.2 Level A** — the PRD commits to Level A; AA / AAA conformance and manual screen-reader audits are out of scope.

### Architecturally non-foreclosed (must not require ground-up rewrite to add later)

- Multi-user with authentication.
- Per-todo metadata fields (priority, due date, tags).
- Real-time sync and collaboration.
- Audit log of todo changes.

The architect must address these explicitly in the architecture document. Other excluded features (notifications, deadlines, etc.) carry no such obligation.

## Stakeholder-Imposed Constraints

These are decisions Aman has fixed up-front as the project sponsor. They are *not* architectural recommendations — the architect inherits them as the boundaries within which all design work happens. Everything outside this list remains the architect's call.

- **Aman has fixed the backend runtime to Fastify (Node.js).** Rationale: stack familiarity for the learning exercise. Architect must work within this; alternative runtimes are not on the table.
- **Aman has fixed the frontend framework to React.** Rationale: same as above.
- **Aman has fixed deployment to local-only, Dockerized, with environment-driven config and backend health checks.** No cloud or production-hardening obligations for v1; CI scope is deferred (see *Open Questions*).

What the architect still decides (non-exhaustive): persistence technology, module and package structure, API shape and versioning approach, ORM/query layer, validation library, frontend state management, build tooling, container topology, and how the non-foreclosure list (auth, per-todo metadata, real-time sync, audit log) is accommodated without ground-up rewrite.

## Guiding Principles

1. **Smallest thing that validates the assumption.** No feature lands in v1 unless it's required by the success criteria above.
2. **Boring technology where possible.** This is a learning exercise; novel stack choices add noise, not signal.
3. **Clarity over cleverness.** A future developer reading the codebase should be able to extend it without an oral-history briefing.
4. **Forward-compatible, not future-proofed.** The non-foreclosure list is the architectural extension contract. Anything beyond it is out of bounds for v1 design.

## Vision

If this exercise succeeds, the artifacts and the workflow — not the todo app — graduate. The running app gets archived or thrown away; what carries forward is a calibrated sense of *what good BMad planning looks like for a small full-stack project*, ready to be re-applied to the next, less trivial, problem domain.

There is no v2 of bmad-todo planned. The non-foreclosure list exists to keep the architectural exercise honest, not because those features will actually be built.

---

## Open Questions / Risks for the PRD

These are flagged here so the PRD author (also John) can resolve or escalate during the next stage. Not blockers for this brief.

1. **Persistence choice timing.** Architect decides, but the PRD will need to commit before stories are written — or the stories must be written persistence-agnostic.
2. **API contract authority.** Is the API shape PM-defined, architect-defined, or co-designed? Default assumption: architect-defined within constraints from the PRD.
3. **What "responsive" means concretely.** Mobile breakpoint? Touch target sizes? Defaulting to "doesn't look broken at common phone widths" unless contradicted.
4. **Error-state taxonomy.** Network failure, server error, validation error — does the PRD enumerate, or hand-wave to "graceful"? Recommendation: enumerate the few that matter, hand-wave the rest.
5. **E2E testing and CI scope (deferred).** Aman wants CI to run end-to-end tests eventually, but the choice of E2E framework, the CI platform, and what "in scope for v1" means here are explicitly TBD. The PRD should either commit during planning or defer to architecture/test-architect with a clear handoff.
