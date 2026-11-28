// UC-6 Supervise the request queue. Actor: Limited Admin (maintenance supervisor). Owner: Muhammad Aun.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, openRequest, details, createPending, readRequest, workOrdersFor, apiAs } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

test('UC6-M main flow: supervisor approves a pending request -> work order page; one OPEN work order', async ({ page }) => {
  const req = await createPending('requester1', 'UC6 Gutter blocked');
  await login(page, 'limitedAdmin');
  await openRequest(page, req.id);
  await details(page).getByRole('button', { name: 'Approve' }).click();
  await page.waitForURL(/\/app\/work-orders\/\d+/);
  const wos = await workOrdersFor(req.id);
  expect(wos).toHaveLength(1);
  expect(wos[0].status).toBe('OPEN');
});

test('UC6-A1 alternative: supervisor rejects with feedback -> request cancelled, reason stored', async ({ page }) => {
  const req = await createPending('requester2', 'UC6 Not our building');
  await login(page, 'limitedAdmin');
  await openRequest(page, req.id);
  await details(page).getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog').last();
  await dialog.getByLabel('Feedback').fill('Belongs to the neighbouring block');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toBeHidden();
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(true);
  expect(stored.cancellationReason).toBe('Belongs to the neighbouring block');
});

test("UC6-A2 alternative: supervisor sees every requester's requests in one queue and opens one from the list", async ({ page }) => {
  await createPending('requester1', 'UC6 From Sara');
  await createPending('requester2', 'UC6 From Umar');
  await login(page, 'limitedAdmin');
  await page.goto('/app/requests');
  await expect(page.getByRole('row').filter({ hasText: 'UC6 From Sara' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'UC6 From Umar' })).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'UC6 From Umar' }).click();
  await expect(details(page)).toContainText('UC6 From Umar');
  await expect(details(page).getByRole('button', { name: 'Approve' })).toBeVisible();
});

test('UC6-E1 exception: the supervisor cannot submit requests (no "+ Request"; the API refuses with 403)', async ({ page }) => {
  await login(page, 'limitedAdmin');
  await page.goto('/app/requests');
  await expect(page.getByRole('heading', { name: 'Requests' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request', exact: true })).toHaveCount(0);
  expect((await apiAs('limitedAdmin', 'POST', '/requests', { title: 'UC6 Supervisor request' })).status).toBe(403);
});

test('UC6-E2 exception: an already approved request offers no Approve or Reject (BR-2)', async ({ page }) => {
  const req = await createPending('requester1', 'UC6 Already approved');
  expect((await apiAs('admin', 'PATCH', `/requests/${req.id}/approve`, {})).status).toBe(200);
  await login(page, 'limitedAdmin');
  await page.goto(`/app/requests/${req.id}`);
  await page.waitForTimeout(2000);
  // The list opens approved requests as their work order; a direct link must not offer a second decision.
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
  expect(await workOrdersFor(req.id)).toHaveLength(1);
});
