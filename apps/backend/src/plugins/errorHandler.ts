import fp from 'fastify-plugin';
import { AppError, InternalError } from '../errors.js';

interface FastifyValidationError extends Error {
  validation?: unknown;
}

export default fp(async (fastify) => {
  fastify.setErrorHandler((err: unknown, request, reply) => {
    const error = err as FastifyValidationError;

    // Zod validation errors come through @fastify/type-provider-zod
    if (error.validation !== undefined) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
          details: error.validation,
        },
      });
    }

    if (err instanceof AppError) {
      // 4xx logged at info, 5xx at error (architecture line 660)
      if (err.httpStatus >= 500) {
        request.log.error({ err }, err.message);
      } else {
        request.log.info({ err }, err.message);
      }
      return reply.status(err.httpStatus).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }

    // Unknown error — log full and return scrubbed InternalError envelope.
    const internal = new InternalError();
    request.log.error({ err }, 'unhandled error');
    return reply.status(internal.httpStatus).send({
      error: { code: internal.code, message: internal.message },
    });
  });
});
