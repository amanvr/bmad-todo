import fp from 'fastify-plugin';

/**
 * Auth-readiness seam (architecture lines 295-299).
 *
 * v1 hard-codes `request.userId = 'default-user'`. When auth lands later, this plugin's
 * onRequest hook is replaced with session/JWT extraction; everything downstream
 * (services, repositories) stays unchanged.
 */
export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    request.userId = 'default-user';
  });
});
