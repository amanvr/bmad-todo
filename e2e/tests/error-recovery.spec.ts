import { expect, test } from '@playwright/test';

test('user sees error state on load failure and recovers via Try again', async ({ page }) => {
  let failNext = true;
  await page.route('**/api/todos', async (route) => {
    if (route.request().method() === 'GET' && failNext) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');

  const errorAlert = page.getByRole('alert');
  await expect(errorAlert).toContainText(/server error/i);
  await expect(errorAlert).not.toContainText(/INTERNAL_ERROR/);

  failNext = false;
  await page.getByRole('button', { name: /try again/i }).click();
  await expect(page.getByRole('status').or(page.getByRole('list'))).toBeVisible();
});

test('mutation failure shows inline error without unmounting existing todos', async ({ page }) => {
  const existingDescription = `Persistent task ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel(/new todo/i).fill(existingDescription);
  await page.getByRole('button', { name: /add todo/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: existingDescription })).toBeVisible();

  await page.route('**/api/todos', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Could not save' } }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByLabel(/new todo/i).fill(`Will fail ${Date.now()}`);
  await page.getByRole('button', { name: /add todo/i }).click();

  const errorAlert = page.getByRole('alert');
  await expect(errorAlert).toContainText(/could not save/i);
  await expect(errorAlert).not.toContainText(/INTERNAL_ERROR/);
  await expect(page.getByRole('listitem').filter({ hasText: existingDescription })).toBeVisible();

  await page.getByRole('button', { name: /dismiss error/i }).click();
  await expect(page.getByRole('button', { name: /dismiss error/i })).not.toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: existingDescription })).toBeVisible();
});
