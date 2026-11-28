// UC-4 Follow the progress of my request. Actor: Requester. Owner: Mohsin Khan.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, details, createPending, apiAs, readRequest } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

const row = (page, title) => page.getByRole('row').filter({ hasText: title });

test('UC4-M main flow: requester sees the submitted request listed as Pending', async ({ page }) => {
  await createPending('requester1', 'UC4 Pending request');
  await login(page, 'requester1');
  await page.goto('/app/requests');
  await expect(row(page, 'UC4 Pending request')).toContainText('Pending');
});

test('UC4-A1 alternative: after an Admin approves, the requester sees Approved', async ({ page }) => {
  const req = await createPending('requester1', 'UC4 Approved request');
  expect((await apiAs('admin', 'PATCH', `/requests/${req.id}/approve`, {})).status).toBe(200);
  await login(page, 'requester1');
  await page.goto('/app/requests');
  await expect(row(page, 'UC4 Approved request')).toContainText('Approved');
  expect((await readRequest(req.id)).workOrder).toBeTruthy();
});

test('UC4-A2 alternative: after rejection, the requester sees Rejected and the request shows Cancelled', async ({ page }) => {
  const req = await createPending('requester1', 'UC4 Rejected request');
  expect((await apiAs('admin', 'PATCH', `/requests/${req.id}/cancel?reason=Duplicate`)).status).toBe(200);
  await login(page, 'requester1');
  await page.goto('/app/requests');
  await expect(row(page, 'UC4 Rejected request')).toContainText('Rejected');
  await row(page, 'UC4 Rejected request').click();
  await expect(details(page)).toContainText('Cancelled');
});

test("UC4-E1 exception: another requester's request is not listed", async ({ page }) => {
  await createPending('requester2', 'UC4 Someone else request');
  await createPending('requester1', 'UC4 My own request');
  await login(page, 'requester1');
  await page.goto('/app/requests');
  await expect(row(page, 'UC4 My own request')).toBeVisible();
  await expect(row(page, 'UC4 Someone else request')).toHaveCount(0);
});

test("UC4-E2 exception: opening another requester's request by its address shows no details (403)", async ({ page }) => {
  const other = await createPending('requester2', 'UC4 Private request');
  await login(page, 'requester1');
  await page.goto(`/app/requests/${other.id}`);
  await page.waitForTimeout(2000);
  await expect(page.getByText('UC4 Private request')).toHaveCount(0);
  expect((await apiAs('requester1', 'GET', `/requests/${other.id}`)).status).toBe(403);
});
