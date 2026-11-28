// UC-1 Submit a maintenance request. Actor: Requester. Owner: Jaweria Abdul Hameed.
// Specification: docs/section-2-6-use-cases.md
import { test, expect } from '@playwright/test';
import { resetEnvironment, clearTokens, login, fillNewRequest, listStatus, openRequest, details, apiAs, myRequestTitles, readRequest, createPending } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { resetEnvironment(); clearTokens(); });

test('UC1-M main flow: requester submits a title -> confirmation, listed as Pending, stored pending', async ({ page }) => {
  await login(page, 'requester1');
  const title = 'UC1 Leaking tap in Room 101';
  const dialog = await fillNewRequest(page, { title });
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Work Order successfully requested').first()).toBeVisible();
  const row = await listStatus(page, title);
  await expect(row).toContainText('Pending');
  const mine = await apiAs('requester1', 'POST', '/requests/search', { filterFields: [], pageNum: 0, pageSize: 50, direction: 'DESC', sortField: 'id' });
  const stored = mine.body.content.find((r) => r.title === title);
  expect(stored.cancelled).toBe(false);
  expect(stored.workOrder ?? null).toBeNull();
});

test('UC1-A1 alternative: with description and High priority -> both shown and stored', async ({ page }) => {
  await login(page, 'requester1');
  const title = 'UC1 Broken window latch';
  const dialog = await fillNewRequest(page, { title, description: 'Latch on the second-floor window is loose', priority: 'High' });
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Work Order successfully requested').first()).toBeVisible();
  await page.getByRole('row').filter({ hasText: title }).click();
  await expect(details(page)).toContainText('High');
  const id = Number(page.url().split('/').pop());
  const stored = await readRequest(id);
  expect(stored.priority).toBe('HIGH');
  expect(stored.description).toBe('Latch on the second-floor window is loose');
});

test('UC1-A2 alternative: requester corrects the title before review -> saved', async ({ page }) => {
  const req = await createPending('requester1', 'UC1 Flickering lihgt');
  await login(page, 'requester1');
  await openRequest(page, req.id);
  await details(page).locator('button:has(svg[data-testid="EditTwoToneIcon"])').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="title"]').fill('UC1 Flickering light');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('The changes have been saved').first()).toBeVisible();
  expect((await readRequest(req.id)).title).toBe('UC1 Flickering light');
});

test('UC1-E1 exception: title left empty -> "Request title is required", nothing stored', async ({ page }) => {
  await login(page, 'requester1');
  const before = (await myRequestTitles('requester1')).length;
  const dialog = await fillNewRequest(page, { description: 'No title given' });
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog.getByText('Request title is required')).toBeVisible();
  await expect(dialog).toBeVisible();
  expect((await myRequestTitles('requester1')).length).toBe(before);
});

test('UC1-E2 exception: title of spaces only -> should be refused (A-2); baseline stores it (defect D2)', async ({ page }) => {
  test.fail(true, 'Known defect D2 (#7): a whitespace-only title is accepted and stored as ""');
  await login(page, 'requester1');
  const before = (await myRequestTitles('requester1')).length;
  const dialog = await fillNewRequest(page, { title: '     ' });
  await dialog.getByRole('button', { name: 'Add' }).click();
  await page.waitForTimeout(2000);
  expect((await myRequestTitles('requester1')).length, 'a request with a blank title was stored').toBe(before);
});
