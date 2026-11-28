// UC-3 Reject a maintenance request with feedback. Actor: Admin (or Limited Admin). Owner: Mohsin Khan.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, openRequest, details, createPending, readRequest, workOrdersFor } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

async function openRejectDialog(page, id) {
  await openRequest(page, id);
  await details(page).getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toContainText('Feedback');
  return dialog;
}

test('UC3-M main flow: Admin rejects with feedback -> shown as Cancelled/Rejected; reason stored; no work order', async ({ page }) => {
  const req = await createPending('requester1', 'UC3 Duplicate tap request');
  await login(page, 'admin');
  const dialog = await openRejectDialog(page, req.id);
  await dialog.getByLabel('Feedback').fill('Duplicate of R000001');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toBeHidden();
  await page.goto('/app/requests');
  await expect(page.getByRole('row').filter({ hasText: 'UC3 Duplicate tap request' })).toContainText('Rejected');
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(true);
  expect(stored.cancellationReason).toBe('Duplicate of R000001');
  expect(await workOrdersFor(req.id)).toHaveLength(0);
});

test('UC3-A1 alternative: the Limited Admin rejects (BR-1 condition B)', async ({ page }) => {
  const req = await createPending('requester2', 'UC3 Out of scope request');
  await login(page, 'limitedAdmin');
  const dialog = await openRejectDialog(page, req.id);
  await dialog.getByLabel('Feedback').fill('Handled by the landlord');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toBeHidden();
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(true);
  expect(stored.cancellationReason).toBe('Handled by the landlord');
});

test('UC3-A2 alternative: Admin opens the Reject dialog and closes it -> request still pending and decidable', async ({ page }) => {
  const req = await createPending('requester1', 'UC3 Changed my mind');
  await login(page, 'admin');
  const dialog = await openRejectDialog(page, req.id);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(details(page).getByRole('button', { name: 'Approve' })).toBeVisible();
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(false);
});

test('UC3-E1 exception: empty feedback -> "Feedback is required", request not rejected (BR-4)', async ({ page }) => {
  const req = await createPending('requester1', 'UC3 No feedback given');
  await login(page, 'admin');
  const dialog = await openRejectDialog(page, req.id);
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog.getByText('Feedback is required')).toBeVisible();
  expect((await readRequest(req.id)).cancelled).toBe(false);
});

test('UC3-E2 exception: feedback of spaces only -> refused by the server, request not rejected (BR-4)', async ({ page }) => {
  const req = await createPending('requester1', 'UC3 Blank feedback');
  await login(page, 'admin');
  const dialog = await openRejectDialog(page, req.id);
  await dialog.getByLabel('Feedback').fill('     ');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await page.waitForTimeout(2000);
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(false);
  expect(stored.cancellationReason ?? null).toBeNull();
});
