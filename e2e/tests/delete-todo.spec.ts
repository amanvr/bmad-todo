import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function clearTodos(page: Page): Promise<void> {
  const allDeleteButtons = page.getByRole('button', { name: /^Delete "/ });
  for (let attempts = 0; attempts < 500; attempts += 1) {
    const count = await allDeleteButtons.count();
    if (count === 0) return;
    try {
      await allDeleteButtons.first().click({ timeout: 1_000 });
    } catch {
      await page.waitForTimeout(100);
    }
  }
}

test('user can delete todos and empty-state returns', async ({ page }) => {
  const stamp = Date.now();
  const first = `Delete me first ${stamp}`;
  const second = `Delete me second ${stamp}`;

  await page.goto('/');

  await clearTodos(page);
  await expect(page.getByRole('status').or(page.getByRole('list'))).toBeVisible();

  const input = page.getByLabel(/new todo/i);
  const addButton = page.getByRole('button', { name: /add todo/i });
  await input.fill(first);
  await addButton.click();
  await expect(page.getByRole('listitem').filter({ hasText: first })).toBeVisible();
  await input.fill(second);
  await addButton.click();
  await expect(page.getByRole('listitem').filter({ hasText: second })).toBeVisible();

  await page.getByRole('button', { name: `Delete "${first}"` }).click();
  await expect(page.getByRole('listitem').filter({ hasText: first })).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: second })).toBeVisible();

  await page.getByRole('button', { name: `Delete "${second}"` }).click();
  await expect(page.getByRole('listitem').filter({ hasText: second })).toHaveCount(0);
  await clearTodos(page);
  await expect(page.getByRole('status')).toContainText(/no todos/i);

  await page.reload();
  await expect(page.getByRole('status')).toContainText(/no todos/i);
});
