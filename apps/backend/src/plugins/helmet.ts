import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

export default fp(async (fastify) => {
  await fastify.register(helmet, {
    // defaults are fine for v1 (architecture line 306)
  });
});
