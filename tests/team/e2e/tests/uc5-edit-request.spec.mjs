// UC-5 Edit a pending request. Actor: Requester (the creator). Owner: Muhammad Aun.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, openRequest, details, createPending, readRequest, apiAs } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

async function openEdit(page, id) {
  await openRequest(page, id);
  await details(page).locator('button:has(svg[data-testid="EditTwoToneIcon"])').click();
  return page.getByRole('dialog');
}

test('UC5-M main flow: creator changes the title -> "The changes have been saved"; new title stored', async ({ page }) => {
  const req = await createPending('requester1', 'UC5 Radiator cold');
  await login(page, 'requester1');
  const dialog = await openEdit(page, req.id);
  await dialog.locator('input[name="title"]').fill('UC5 Radiator cold in Room 12');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('The changes have been saved').first()).toBeVisible();
  expect((await readRequest(req.id)).title).toBe('UC5 Radiator cold in Room 12');
});

test('UC5-A1 alternative: only the priority is changed -> priority stored, title and description kept', async ({ page }) => {
  const req = await createPending('requester1', 'UC5 Lift makes noise');
  await login(page, 'requester1');
  const dialog = await openEdit(page, req.id);
  await dialog.getByLabel('Priority').click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('The changes have been saved').first()).toBeVisible();
  const stored = await readRequest(req.id);
  expect(stored.priority).toBe('HIGH');
  expect(stored.title).toBe('UC5 Lift makes noise');
  expect(stored.description).toBe('Created for a use-case test');
});

test('UC5-A2 alternative: the edit dialog is closed without saving -> nothing changes', async ({ page }) => {
  const req = await createPending('requester1', 'UC5 Keep as is');
  await login(page, 'requester1');
  const dialog = await openEdit(page, req.id);
  await dialog.locator('input[name="title"]').fill('UC5 Should not be saved');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await readRequest(req.id)).title).toBe('UC5 Keep as is');
});

test('UC5-E1 exception: title cleared -> "Request title is required", title unchanged', async ({ page }) => {
  const req = await createPending('requester1', 'UC5 Do not blank me');
  await login(page, 'requester1');
  const dialog = await openEdit(page, req.id);
  await dialog.locator('input[name="title"]').fill('');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Request title is required')).toBeVisible();
  expect((await readRequest(req.id)).title).toBe('UC5 Do not blank me');
});

test('UC5-E2 exception: the request was approved meanwhile -> the edit is refused, title unchanged (BR-2)', async ({ page }) => {
  const req = await createPending('requester1', 'UC5 Approved before edit');
  await login(page, 'requester1');
  const dialog = await openEdit(page, req.id);
  // An Admin approves while the requester has the edit dialog open.
  expect((await apiAs('admin', 'PATCH', `/requests/${req.id}/approve`, {})).status).toBe(200);
  await dialog.locator('input[name="title"]').fill('UC5 Too late to edit');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText("The Request couldn't be edited").first()).toBeVisible();
  expect((await readRequest(req.id)).title).toBe('UC5 Approved before edit');
});
