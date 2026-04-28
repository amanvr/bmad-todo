import type { CreateTodoInput, Todo } from '@bmad-todo/shared';
import type { TodoRepository } from '../repositories/todoRepository.js';

export class TodoService {
  constructor(private readonly repo: TodoRepository) {}

  async listTodos(userId: string): Promise<Todo[]> {
    return this.repo.list(userId);
  }

  async createTodo(input: CreateTodoInput, userId: string): Promise<Todo> {
    return this.repo.create(input, userId);
  }

  async setCompleted(id: string, completed: boolean, userId: string): Promise<Todo> {
    return this.repo.setCompleted(id, completed, userId);
  }

  async deleteTodo(id: string, userId: string): Promise<void> {
    await this.repo.delete(id, userId);
  }
}
