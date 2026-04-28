import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  CreateTodoInputSchema,
  TodoSchema,
  UpdateTodoCompletionInputSchema,
} from '@bmad-todo/shared';
import { z } from 'zod';
import type { TodoService } from '../services/todoService.js';

export function buildTodoController(service: TodoService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'GET',
      url: '/api/todos',
      schema: {
        response: {
          200: z.array(TodoSchema),
        },
      },
      handler: async (request) => service.listTodos(request.userId),
    });

    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'POST',
      url: '/api/todos',
      schema: {
        body: CreateTodoInputSchema,
        response: {
          201: TodoSchema,
        },
      },
      handler: async (request, reply) => {
        const todo = await service.createTodo(request.body, request.userId);
        return reply.code(201).send(todo);
      },
    });

    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'PATCH',
      url: '/api/todos/:id',
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: UpdateTodoCompletionInputSchema,
        response: {
          200: TodoSchema,
        },
      },
      handler: async (request) =>
        service.setCompleted(request.params.id, request.body.completed, request.userId),
    });

    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'DELETE',
      url: '/api/todos/:id',
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
        },
      },
      handler: async (request, reply) => {
        await service.deleteTodo(request.params.id, request.userId);
        return reply.code(204).send(null);
      },
    });
  };
}
