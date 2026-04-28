import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoLevelAViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag22a']).analyze();

  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (violation) =>
          `  - [${violation.id}] ${violation.help} — ${violation.nodes.length} node(s)`,
      )
      .join('\n');
    console.error(`Axe violations on '${label}':\n${summary}`);
  }

  expect(results.violations, `Axe Level A violations on '${label}'`).toEqual([]);
}

test.describe('Accessibility — WCAG 2.2 Level A scan', () => {
  test('loaded state with todos', async ({ page, request }) => {
    const stamp = Date.now();
    await request.post('/api/todos', { data: { description: `A11y todo 1 ${stamp}` } });
    await request.post('/api/todos', { data: { description: `A11y todo 2 ${stamp}` } });

    await page.goto('/');
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await expectNoLevelAViolations(page, 'loaded');
  });

  test('empty state', async ({ page }) => {
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }

      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toContainText(/no todos/i);
    await expectNoLevelAViolations(page, 'empty');
  });

  test('loading state (mocked delay)', async ({ page }) => {
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }

      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toContainText(/loading/i);
    await expectNoLevelAViolations(page, 'loading');
  });

  test('error state (mocked failure)', async ({ page }) => {
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') {
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
    await expect(page.getByRole('alert')).toContainText(/server error/i);
    await expectNoLevelAViolations(page, 'error');
  });
});
