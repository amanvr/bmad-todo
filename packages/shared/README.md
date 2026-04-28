# `@bmad-todo/shared`

Canonical Zod schemas + inferred TypeScript types for the bmad-todo API contract.

## The "edit-here-first" rule

**Any change to the API contract starts here.**

Adding a field to `Todo`, introducing a new error code, evolving the health-response shape: update the schema in `packages/shared/src/`, then run consumer tests in both `apps/backend` and `apps/frontend` to surface the type-error fallout, then resolve those errors. Reverse order leads to schema/code drift.

## What's exported

- `Todo`, `TodoSchema` — read-shape (wire format).
- `CreateTodoInput`, `CreateTodoInputSchema` — POST body for `/api/todos`.
- `UpdateTodoCompletionInput`, `UpdateTodoCompletionInputSchema` — PATCH body for toggle.
- `ErrorCode`, `ErrorCodeSchema` — enum: `'VALIDATION_FAILED' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'PERSISTENCE_UNAVAILABLE'`.
- `ApiError`, `ApiErrorSchema` — bare error shape.
- `ApiErrorEnvelope`, `ApiErrorEnvelopeSchema` — wire format `{ error: ApiError }`.
- `HealthResponse`, `HealthResponseSchema` — `{ status, persistence? }`.

## What's NOT here

- Runtime business logic (services / repositories).
- Framework code (Fastify plugins, React components).
- Database schemas (Drizzle's `apps/backend/src/db/schema.ts`).

## Build & consumption

```bash
# Build (emits dist/)
npm run build --workspace @bmad-todo/shared

# Test schemas
npm test --workspace @bmad-todo/shared
```

Workspace consumers reference via `@bmad-todo/shared` and TypeScript composite-project references resolve cross-package types. Both `.js` and `.d.ts` are emitted (despite the AC's `--emitDeclarationOnly` mention — that text was imprecise; Zod schemas are runtime values that must be importable, not just types).

## Non-foreclosure paths held open

- Per-todo metadata (`priority`, `due_date`, `tags`) → adds nullable schema fields without migration.
- Multi-user → re-introduces `userId` to `TodoSchema` once auth lands.
- Audit-event types → new schema file, no changes to existing schemas.
- Real-time sync → adds optional event schemas; existing CRUD schemas unchanged.
