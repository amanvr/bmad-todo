import { z } from 'zod';

export const HealthStatusSchema = z.enum(['healthy', 'unhealthy']);
export const PersistenceStatusSchema = z.enum(['up', 'down']);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  // `persistence` is optional in v1.4 (returns `{status: 'healthy'}` only).
  // Story 3.4 will populate `persistence` and the schema becomes effectively required.
  persistence: PersistenceStatusSchema.optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
