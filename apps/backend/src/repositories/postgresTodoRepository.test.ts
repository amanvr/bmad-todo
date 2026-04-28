import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../errors.js';
import { PostgresTodoRepository } from './postgresTodoRepository.js';

type Row = {
  id: string;
  description: string;
  completed: boolean;
  userId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'd2b1f35b-53a3-4f0f-9e8d-170b38937d64',
    description: 'todo',
    completed: false,
    userId: 'default-user',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('PostgresTodoRepository', () => {
  it('list maps rows to wire shape and sorts via query chain', async () => {
    const rows = [
      makeRow({ id: 'b', description: 'b', createdAt: '2026-01-02T10:00:00.000Z' }),
      makeRow({ id: 'a', description: 'a', createdAt: new Date('2026-01-01T10:00:00.000Z') }),
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ConstructorParameters<typeof PostgresTodoRepository>[0];

    const repo = new PostgresTodoRepository(db);
    const result = await repo.list('default-user');

    expect(select).toHaveBeenCalled();
    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'b',
        description: 'b',
        completed: false,
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'a',
        description: 'a',
        completed: false,
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
  });

  it('create returns inserted row mapped to domain', async () => {
    const returning = vi.fn().mockResolvedValue([
      makeRow({
        id: '5bd85cec-82ff-4298-9e04-73655d9d6376',
        description: 'new todo',
        createdAt: '2026-01-03T10:00:00.000Z',
        updatedAt: '2026-01-03T10:00:00.000Z',
      }),
    ]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as ConstructorParameters<typeof PostgresTodoRepository>[0];

    const repo = new PostgresTodoRepository(db);
    const todo = await repo.create({ description: 'new todo' }, 'default-user');

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({ description: 'new todo', userId: 'default-user' });
    expect(todo.description).toBe('new todo');
    expect(todo.createdAt).toBe('2026-01-03T10:00:00.000Z');
  });

  it('create throws when insert unexpectedly returns no row', async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as ConstructorParameters<typeof PostgresTodoRepository>[0];

    const repo = new PostgresTodoRepository(db);
    await expect(repo.create({ description: 'missing row' }, 'default-user')).rejects.toThrow(
      'insert returned no row',
    );
  });

  it('setCompleted updates row and throws NotFoundError when missing', async () => {
    const returning = vi
      .fn()
      .mockResolvedValueOnce([
        makeRow({
          completed: true,
          updatedAt: '2026-01-04T10:00:00.000Z',
        }),
      ])
      .mockResolvedValueOnce([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as unknown as ConstructorParameters<typeof PostgresTodoRepository>[0];

    const repo = new PostgresTodoRepository(db);
    const updated = await repo.setCompleted(
      'd2b1f35b-53a3-4f0f-9e8d-170b38937d64',
      true,
      'default-user',
    );
    expect(updated.completed).toBe(true);

    await expect(
      repo.setCompleted('00000000-0000-0000-0000-000000000000', false, 'default-user'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('delete succeeds when row exists and throws NotFoundError when missing', async () => {
    const returning = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'abc' }])
      .mockResolvedValueOnce([]);
    const where = vi.fn().mockReturnValue({ returning });
    const del = vi.fn().mockReturnValue({ where });
    const db = { delete: del } as unknown as ConstructorParameters<
      typeof PostgresTodoRepository
    >[0];

    const repo = new PostgresTodoRepository(db);
    await expect(
      repo.delete('d2b1f35b-53a3-4f0f-9e8d-170b38937d64', 'default-user'),
    ).resolves.toBeUndefined();
    await expect(
      repo.delete('00000000-0000-0000-0000-000000000000', 'default-user'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
