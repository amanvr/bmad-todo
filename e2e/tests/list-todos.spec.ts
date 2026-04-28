import { expect, test } from '@playwright/test';

test.describe('list-todos (NFR20 flow #2)', () => {
  const stamp = Date.now();
  const seedTodos = [`First task ${stamp}`, `Second task ${stamp}`, `Third task ${stamp}`];

  test.beforeEach(async ({ request }) => {
    const existingResponse = await request.get('/api/todos');
    expect(existingResponse.status()).toBe(200);
    const existingTodos = (await existingResponse.json()) as Array<{ id: string }>;
    for (const todo of existingTodos) {
      const deleteResponse = await request.delete(`/api/todos/${todo.id}`);
      expect(deleteResponse.status()).toBe(204);
    }

    for (const description of seedTodos) {
      const response = await request.post('/api/todos', { data: { description } });
      expect(response.status()).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  });

  test('renders pre-seeded todos in created_at DESC order and survives reload', async ({
    page,
  }) => {
    await page.goto('/');

    const expectedOrder = [...seedTodos].reverse();
    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(seedTodos.length);
    for (const [index, description] of expectedOrder.entries()) {
      await expect(items.nth(index)).toContainText(description);
    }

    await page.reload();
    await expect(page.getByRole('listitem')).toHaveCount(seedTodos.length);
    for (const [index, description] of expectedOrder.entries()) {
      await expect(page.getByRole('listitem').nth(index)).toContainText(description);
    }
  });
});
