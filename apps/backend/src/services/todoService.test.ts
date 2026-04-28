import { describe, expect, it, vi } from 'vitest';
import type { TodoRepository } from '../repositories/todoRepository.js';
import { TodoService } from './todoService.js';
import { NotFoundError } from '../errors.js';

describe('TodoService', () => {
  it('delegates listTodos() to repository.list()', async () => {
    const list = vi.fn().mockResolvedValue([]);
    const repo = {
      list,
      create: vi.fn(),
      setCompleted: vi.fn(),
      delete: vi.fn(),
    } as unknown as TodoRepository;
    const service = new TodoService(repo);

    await service.listTodos('default-user');

    expect(list).toHaveBeenCalledWith('default-user');
  });

  it('delegates createTodo() to repository.create()', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'd6b57ca4-c25f-4d31-a791-2f7c75f6b2f6',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const repo = {
      list: vi.fn(),
      create,
      setCompleted: vi.fn(),
      delete: vi.fn(),
    } as unknown as TodoRepository;
    const service = new TodoService(repo);

    await service.createTodo({ description: 'Buy milk' }, 'default-user');

    expect(create).toHaveBeenCalledWith({ description: 'Buy milk' }, 'default-user');
  });

  it('delegates setCompleted() to repository.setCompleted()', async () => {
    const setCompleted = vi.fn().mockResolvedValue({
      id: 'd6b57ca4-c25f-4d31-a791-2f7c75f6b2f6',
      description: 'Buy milk',
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const repo = {
      list: vi.fn(),
      create: vi.fn(),
      setCompleted,
      delete: vi.fn(),
    } as unknown as TodoRepository;
    const service = new TodoService(repo);

    await service.setCompleted('d6b57ca4-c25f-4d31-a791-2f7c75f6b2f6', true, 'default-user');

    expect(setCompleted).toHaveBeenCalledWith(
      'd6b57ca4-c25f-4d31-a791-2f7c75f6b2f6',
      true,
      'default-user',
    );
  });

  it('delegates deleteTodo() to repository.delete()', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const repo = {
      list: vi.fn(),
      create: vi.fn(),
      setCompleted: vi.fn(),
      delete: remove,
    } as unknown as TodoRepository;
    const service = new TodoService(repo);

    await service.deleteTodo('d6b57ca4-c25f-4d31-a791-2f7c75f6b2f6', 'default-user');

    expect(remove).toHaveBeenCalledWith('d6b57ca4-c25f-4d31-a791-2f7c75f6b2f6', 'default-user');
  });

  it('rethrows NotFoundError from repository.delete()', async () => {
    const missingError = new NotFoundError('Todo not found');
    const repo = {
      list: vi.fn(),
      create: vi.fn(),
      setCompleted: vi.fn(),
      delete: vi.fn().mockRejectedValue(missingError),
    } as unknown as TodoRepository;
    const service = new TodoService(repo);

    await expect(
      service.deleteTodo('d6b57ca4-c25f-4d31-a791-2f7c75f6b2f6', 'default-user'),
    ).rejects.toBe(missingError);
  });
});
