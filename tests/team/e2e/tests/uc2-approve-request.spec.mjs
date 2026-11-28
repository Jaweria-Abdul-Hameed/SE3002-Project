// UC-2 Approve a maintenance request. Actor: Admin (or Limited Admin). Owner: Jaweria Abdul Hameed.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, openRequest, details, createPending, readRequest, workOrdersFor, apiAs } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

async function approveInUi(page, id) {
  await openRequest(page, id);
  await details(page).getByRole('button', { name: 'Approve' }).click();
}
async function expectApproved(page, req) {
  await page.waitForURL(/\/app\/work-orders\/\d+/);
  await expect(page.getByText(req.title).first()).toBeVisible();
  const stored = await readRequest(req.id);
  expect(stored.workOrder?.id).toBe(Number(page.url().split('/').pop()));
  const wos = await workOrdersFor(req.id);
  expect(wos).toHaveLength(1);
  expect(wos[0].status).toBe('OPEN');
}

test('UC2-M main flow: Admin approves -> work order page opens; request linked to one OPEN work order', async ({ page }) => {
  const req = await createPending('requester1', 'UC2 Leaking tap');
  await login(page, 'admin');
  await approveInUi(page, req.id);
  await expectApproved(page, req);
});

test('UC2-A1 alternative: the Limited Admin approves (BR-1 condition B)', async ({ page }) => {
  const req = await createPending('requester1', 'UC2 Door closer broken');
  await login(page, 'limitedAdmin');
  await approveInUi(page, req.id);
  await expectApproved(page, req);
});

test('UC2-A2 alternative: Admin finds the request with the search box, then approves', async ({ page }) => {
  const req = await createPending('requester2', 'UC2 Noisy air conditioner');
  await login(page, 'admin');
  await page.goto('/app/requests');
  await page.getByPlaceholder('Search').fill('Noisy air');
  await page.getByRole('row').filter({ hasText: 'UC2 Noisy air conditioner' }).click();
  await details(page).getByRole('button', { name: 'Approve' }).click();
  await expectApproved(page, req);
});

test('UC2-E1 exception: a Requester opening the request sees no Approve or Reject (BR-1)', async ({ page }) => {
  const req = await createPending('requester1', 'UC2 Requester cannot decide');
  await login(page, 'requester1');
  await openRequest(page, req.id);
  await expect(details(page)).toContainText('UC2 Requester cannot decide');
  await expect(details(page).getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(details(page).getByRole('button', { name: 'Reject' })).toHaveCount(0);
  expect((await readRequest(req.id)).workOrder ?? null).toBeNull();
});

test('UC2-E2 exception: 30 incomplete work orders already -> approval refused, request stays pending (BR-3)', async ({ page }) => {
  // Bring the company up to the limit through the API (fast); earlier tests already created some work orders.
  for (let i = 0; i < 30; i++) {
    const r = await createPending(i % 2 ? 'requester2' : 'requester1', `UC2 fill ${i + 1}`);
    const a = await apiAs(i % 2 ? 'limitedAdmin' : 'admin', 'PATCH', `/requests/${r.id}/approve`, {});
    if (a.status === 403) break;
  }
  const req = await createPending('requester1', 'UC2 One too many');
  await login(page, 'admin');
  await approveInUi(page, req.id);
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/\/app\/requests/);
  const stored = await readRequest(req.id);
  expect(stored.workOrder ?? null).toBeNull();
  expect(stored.cancelled).toBe(false);
});
