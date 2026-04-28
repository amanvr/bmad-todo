import { expect, test, type ViewportSize } from '@playwright/test';

const viewports: Array<{ name: string; size: ViewportSize }> = [
  { name: 'desktop', size: { width: 1280, height: 720 } },
  { name: 'tablet', size: { width: 768, height: 1024 } },
  { name: 'mobile-portrait', size: { width: 360, height: 640 } },
  { name: 'mobile-landscape', size: { width: 640, height: 360 } },
];

for (const { name, size } of viewports) {
  test.describe(`viewport: ${name} (${size.width}x${size.height})`, () => {
    test('renders without horizontal scroll and all controls reachable', async ({
      page,
      request,
    }) => {
      const existingResponse = await request.get('/api/todos');
      expect(existingResponse.status()).toBe(200);
      const existingTodos = (await existingResponse.json()) as Array<{ id: string }>;
      for (const todo of existingTodos) {
        const deleteResponse = await request.delete(`/api/todos/${todo.id}`);
        expect(deleteResponse.status()).toBe(204);
      }

      const stamp = Date.now();
      await request.post('/api/todos', { data: { description: `Responsive task ${stamp}` } });
      await request.post('/api/todos', {
        data: {
          description:
            `Another responsive task ${stamp} ` +
            'https://example.com/very/long/path/that/should/wrap/without/horizontal/overflow',
        },
      });

      await page.setViewportSize(size);
      await page.goto('/');

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      await expect(page.getByLabel(/new todo/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /add todo/i })).toBeVisible();

      const items = page.getByRole('listitem');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        await expect(items.nth(index).getByRole('checkbox')).toBeVisible();
        await expect(items.nth(index).getByRole('button', { name: /delete /i })).toBeVisible();
      }
    });
  });
}
