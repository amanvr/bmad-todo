import type { Config } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
  interface FastifyInstance {
    config: Config;
  }
}

export {};
