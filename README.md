# bmad-todo

A deliberately minimal full-stack todo web application, built as a learning exercise for the BMad planning-and-execution workflow.

## Status

**Planning complete. Implementation pending.**

The brief, PRD, architecture, and epic / story breakdown are signed off and validated. The application code has not been written yet — execution starts at Story 1.1 of `epics.md`.

This README will be rewritten by Story 4.3 into the dev-team-facing version (Quick Start, Prerequisites, `docker compose up` flow, troubleshooting) that satisfies NFR16's "first-run within 15 minutes on a Docker-installed machine" target. Until then, what follows is enough to navigate the planning artifacts and start dev.

## What this repo currently contains

```
.
├── CLAUDE.md                                 # guidance for Claude Code sessions
├── _bmad-output/planning-artifacts/          # the planning chain (source of truth)
│   ├── product-brief.md                      # signed off
│   ├── prd.md                                # validated (5/5, zero critical issues)
│   ├── prd-validation-report.md
│   ├── architecture.md                       # ready for implementation
│   └── epics.md                              # 4 epics, 18 stories
├── _bmad/                                    # BMad-method install (v6.5.0)
└── .claude/skills/                           # BMad skill scaffolds
```

There is no `package.json`, no source tree, and no build / test / lint commands yet. Everything below the line *"What the running app will be"* is design intent; running code arrives with Story 1.1.

## What the running app will be

A single-page React frontend talking to a Fastify HTTP backend backed by PostgreSQL, all containerized and orchestrated locally via `docker compose`. Single user, no authentication, deliberately minimal UX bar ("doesn't look broken"). The full v1 contract:

- 23 binding functional requirements (`FR1`–`FR23`) covering CRUD on todos, application-lifecycle states, persistence guarantees, operational health, responsive layout, accessibility, and configuration / deployment shape.
- 23 non-functional requirements covering performance (qualitative), baseline security, accessibility (WCAG 2.2 Level A), durability, maintainability, testability (≥ 70% coverage on backend and frontend; ≥ 5 Playwright E2E flows), and cross-OS portability (Linux / macOS / Windows hosts via Docker).
- Architectural seams left in place — but **not implemented** — for four future capabilities: multi-user / authentication, per-todo metadata (priority / due date / tags), real-time sync, audit log.

Full details: `_bmad-output/planning-artifacts/prd.md` and `architecture.md`.

## How implementation works

Story-driven, sequential, one story at a time:

1. Stories live in `_bmad-output/planning-artifacts/epics.md`, sequenced 1.1 → 1.2 → … → 4.3 across four epics.
2. Each story has Given / When / Then acceptance criteria **plus** explicit Test Scenarios per layer (Unit / Integration / E2E).
3. Story 1.1 is the workspace scaffold — npm workspaces, ESLint + Prettier, TypeScript strict, Vitest config, root `README.md` skeleton (which will replace this file with the dev-team-facing version), and the GitHub Actions baseline.
4. Story 1.8 is the first end-to-end "add and view a todo" — at the end of Story 1.8 the app is real and persistent.
5. Story 4.3 is the v1 acceptance gate.

## Getting started (today)

If you want to start implementation:

1. Read `CLAUDE.md` for the implementation conventions and constraints.
2. Read the planning artifacts in order: `product-brief.md` → `prd.md` → `architecture.md` → `epics.md`.
3. (Recommended) Run `/bmad-check-implementation-readiness` for a final cross-artifact alignment check.
4. Invoke `/bmad-dev-story 1.1` (or `/bmad-agent-dev` and pick the implement-story menu item) to start Story 1.1.

If you want to refine the planning chain instead, every BMad skill is invokable from this repo — see `CLAUDE.md` for the entry points.

## A note on tooling

BMad is currently installed for Claude Code only. The IDE list is in `_bmad/_config/manifest.yaml` (`ides:` array). To add Cursor or another IDE adapter, re-run the BMad installer; the planning artifacts themselves are plain markdown and portable to any tool.
