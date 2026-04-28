import { expect, test } from '@playwright/test';

test('keyboard-only: create, complete, delete a todo', async ({ page }) => {
  const description = `Keyboard task ${Date.now()}`;
  await page.goto('/');

  await page.keyboard.press('Tab');
  await page.getByLabel(/new todo/i).focus();
  await page.keyboard.type(description);
  await page.keyboard.press('Enter');

  const item = page.getByRole('listitem').filter({ hasText: description });
  await expect(item).toBeVisible();

  await item.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(item.getByRole('checkbox')).toBeChecked();

  await item.getByRole('button', { name: new RegExp(`Delete "${description}"`) }).focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveCount(0);
});
