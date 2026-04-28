import { z } from 'zod';
import {
  CreateTodoInputSchema,
  TodoSchema,
  UpdateTodoCompletionInputSchema,
  type CreateTodoInput,
  type Todo,
} from '@bmad-todo/shared';
import { httpRequest } from '../../shared/http.js';

export const todosApi = {
  async list(): Promise<Todo[]> {
    const data = await httpRequest<unknown>('/api/todos');
    return z.array(TodoSchema).parse(data);
  },

  async create(input: CreateTodoInput): Promise<Todo> {
    const validated = CreateTodoInputSchema.parse(input);
    const data = await httpRequest<unknown>('/api/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validated),
    });
    return TodoSchema.parse(data);
  },

  async setCompleted(id: string, completed: boolean): Promise<Todo> {
    const validated = UpdateTodoCompletionInputSchema.parse({ completed });
    const data = await httpRequest<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validated),
    });
    return TodoSchema.parse(data);
  },

  async deleteOne(id: string): Promise<void> {
    await httpRequest<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
