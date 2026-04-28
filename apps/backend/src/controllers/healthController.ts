import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { HealthResponseSchema, type HealthResponse } from '@bmad-todo/shared';
import type { Database } from '../db/client.js';
import { probePersistence } from '../db/client.js';

export interface HealthControllerDeps {
  db: Database;
}

export function buildHealthController(deps: HealthControllerDeps): FastifyPluginAsync {
  let lastPersistenceUp: boolean | null = null;

  return async (fastify) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'GET',
      url: '/api/health',
      handler: async (request, reply) => {
        const probe = await probePersistence(deps.db);
        const isUp = probe.status === 'up';

        if (lastPersistenceUp === null) {
          request.log.info(
            { event: `health.persistence.${probe.status}`, previous: null },
            `persistence initial state: ${probe.status}`,
          );
        } else if (lastPersistenceUp && !isUp) {
          request.log.warn(
            { event: 'health.persistence.down', previous: 'up', error: probe.error },
            'persistence transitioned to down',
          );
        } else if (!lastPersistenceUp && isUp) {
          request.log.info(
            { event: 'health.persistence.up', previous: 'down' },
            'persistence transitioned to up',
          );
        }

        lastPersistenceUp = isUp;

        const body: HealthResponse = {
          status: isUp ? 'healthy' : 'unhealthy',
          persistence: probe.status,
        };

        const parsed = HealthResponseSchema.parse(body);
        return reply.code(isUp ? 200 : 503).send(parsed);
      },
    });
  };
}
