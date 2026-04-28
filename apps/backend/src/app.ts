import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import './types.js';
import type { Config } from './config.js';
import { createLogger } from './logger.js';
import corsPlugin from './plugins/cors.js';
import helmetPlugin from './plugins/helmet.js';
import userContextPlugin from './plugins/userContext.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import { buildHealthController } from './controllers/healthController.js';
import { closeDbClient, createDbClient } from './db/client.js';
import { PostgresTodoRepository } from './repositories/postgresTodoRepository.js';
import { TodoService } from './services/todoService.js';
import { buildTodoController } from './controllers/todoController.js';
import type { Logger } from './logger.js';

export interface BuildAppOptions {
  loggerInstance?: Logger;
}

export async function buildApp(config: Config, options: BuildAppOptions = {}) {
  const app = Fastify({
    loggerInstance: options.loggerInstance ?? createLogger(config),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('config', config);

  // Registration order matters: helmet → cors → userContext → errorHandler → controllers
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(userContextPlugin);
  await app.register(errorHandlerPlugin);

  const { db } = createDbClient(config.DATABASE_URL);
  await app.register(buildHealthController({ db }));
  const todoRepository = new PostgresTodoRepository(db);
  const todoService = new TodoService(todoRepository);
  await app.register(buildTodoController(todoService));
  app.addHook('onClose', async () => {
    await closeDbClient();
  });

  return app;
}
