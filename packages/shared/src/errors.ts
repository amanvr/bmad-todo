import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
  'PERSISTENCE_UNAVAILABLE',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorEnvelopeSchema = z.object({
  error: ApiErrorSchema,
});

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
