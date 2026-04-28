import { expect, test } from '@playwright/test';

test('user can create their first todo', async ({ page }) => {
  const description = `Buy milk ${Date.now()}`;

  await page.route('**/api/todos', async (route) => {
    if (route.request().method() === 'GET') {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toContainText(/loading todos/i);
  await expect(page.getByRole('status').or(page.getByRole('list'))).toBeVisible();

  await page.getByLabel(/new todo/i).fill(description);
  await page.getByRole('button', { name: /add todo/i }).click();

  await expect(page.getByRole('listitem').filter({ hasText: description })).toBeVisible({
    timeout: 5_000,
  });

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: description })).toBeVisible();
});
