import { expect, test } from '@playwright/test';

test('user can mark a completed todo as incomplete', async ({ page }) => {
  const description = `Practice piano ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel(/new todo/i).fill(description);
  await page.getByRole('button', { name: /add todo/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: description });
  await expect(item).toBeVisible({ timeout: 5_000 });
  const checkbox = item.getByRole('checkbox');

  await checkbox.click();
  await expect(checkbox).toBeChecked();
  const descriptionEl = item.locator('[class*="description"]').first();
  await expect(descriptionEl).toHaveCSS('text-decoration-line', 'line-through');

  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await expect(descriptionEl).not.toHaveCSS('text-decoration-line', 'line-through');

  await page.reload();
  await expect(
    page.getByRole('listitem').filter({ hasText: description }).getByRole('checkbox'),
  ).not.toBeChecked();
});
