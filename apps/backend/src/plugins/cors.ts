import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async (fastify) => {
  const origins = (fastify.config.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await fastify.register(cors, {
    origin: origins.length > 0 ? origins : false,
    credentials: false,
  });
});
