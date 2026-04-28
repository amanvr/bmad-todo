import { describe, expect, it } from 'vitest';
import { TodoSchema, CreateTodoInputSchema } from './todo.js';

const validTodo = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-04-28T10:00:00Z',
  updatedAt: '2026-04-28T10:00:00Z',
};

describe('TodoSchema', () => {
  it('accepts a valid todo', () => {
    expect(() => TodoSchema.parse(validTodo)).not.toThrow();
  });

  it('rejects empty description', () => {
    expect(() => TodoSchema.parse({ ...validTodo, description: '' })).toThrow();
  });

  it('rejects 501-char description', () => {
    const longDesc = 'x'.repeat(501);
    expect(() => TodoSchema.parse({ ...validTodo, description: longDesc })).toThrow();
  });

  it('rejects missing createdAt', () => {
    const withoutCreatedAt: Partial<typeof validTodo> = { ...validTodo };
    delete withoutCreatedAt.createdAt;
    expect(() => TodoSchema.parse(withoutCreatedAt)).toThrow();
  });

  it('rejects bad UUID', () => {
    expect(() => TodoSchema.parse({ ...validTodo, id: 'not-a-uuid' })).toThrow();
  });

  it('accepts a 500-char description (boundary)', () => {
    const desc = 'x'.repeat(500);
    expect(() => TodoSchema.parse({ ...validTodo, description: desc })).not.toThrow();
  });
});

describe('CreateTodoInputSchema', () => {
  it('accepts a 1-char description', () => {
    expect(() => CreateTodoInputSchema.parse({ description: 'a' })).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => CreateTodoInputSchema.parse({ description: '' })).toThrow();
  });

  it('rejects 501-char', () => {
    expect(() => CreateTodoInputSchema.parse({ description: 'x'.repeat(501) })).toThrow();
  });
});
