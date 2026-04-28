import { expect, test } from '@playwright/test';

test('user can mark a todo complete', async ({ page }) => {
  const description = `Read book ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel(/new todo/i).fill(description);
  await page.getByRole('button', { name: /add todo/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: description });
  await expect(item).toBeVisible({ timeout: 5_000 });
  const checkbox = item.getByRole('checkbox');

  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  const descriptionEl = item.locator('[class*="description"]').first();
  await expect(descriptionEl).toHaveCSS('text-decoration-line', 'line-through');

  await page.reload();
  await expect(
    page.getByRole('listitem').filter({ hasText: description }).getByRole('checkbox'),
  ).toBeChecked();
});
