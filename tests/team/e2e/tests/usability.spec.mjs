// Section 3 usability tests: one per workflow. Owner: Muhammad Aun.
//   US-W1  Submit a request using only the keyboard: focus reaches the required fields and the Add button in
//          the expected order, and the keyboard submits the form; the confirmation is shown.
//   US-W2  Reject a request: first submit what the business rule rejects (BR-4, empty feedback), check that the
//          message says what to correct, correct it, and check the confirmation.
import { test, expect } from '@playwright/test';
import { resetEnvironment, login, openRequest, details, createPending, readRequest, myRequestTitles } from './lib.mjs';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => resetEnvironment());

const focused = (page) => page.evaluate(() => {
  const e = document.activeElement;
  const label = e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText?.replace('*', '').trim();
  return { tag: e.tagName, name: e.getAttribute('name'), label: label ?? '', text: (e.innerText ?? '').trim() };
});

test('US-W1 keyboard only: Tab reaches Title*, Asset* and Add in order; Enter submits; confirmation shown', async ({ page }) => {
  await login(page, 'requester1');
  const before = (await myRequestTitles('requester1')).length;
  // Open the form with the keyboard: focus the "+ Request" button and press Enter.
  await page.getByRole('button', { name: 'Request', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  // Walk the form with Tab and record the order in which controls receive focus.
  const order = [];
  let addIndex = -1;
  for (let i = 1; i <= 60 && addIndex < 0; i++) {
    await page.keyboard.press('Tab');
    const f = await focused(page);
    order.push(f);
    if (i === 1) {
      expect(f.name, 'first Tab should land on the Title field').toBe('title');
      await page.keyboard.type('US-W1 Keyboard-only request');
    }
    if (f.tag === 'BUTTON' && f.text === 'Add') addIndex = i;
  }
  const titleAt = order.findIndex((f) => f.name === 'title');
  const assetAt = order.findIndex((f) => f.label === 'Asset');
  expect(titleAt, 'Title reached').toBe(0);
  expect(assetAt, 'Asset (marked required) reached after Title').toBeGreaterThan(titleAt);
  expect(addIndex, 'the Add button is reachable with Tab').toBeGreaterThan(assetAt + 1);

  // Submit with the keyboard.
  await page.keyboard.press('Enter');
  await expect(page.getByText('Work Order successfully requested').first()).toBeVisible();
  const titles = await myRequestTitles('requester1');
  expect(titles.length).toBe(before + 1);
  expect(titles).toContain('US-W1 Keyboard-only request');
  test.info().annotations.push({ type: 'focus order', description: order.map((f) => f.label || f.name || f.text || f.tag).join(' > ') });
});

test('US-W2 reject: empty feedback is refused with "Feedback is required"; after correcting it, the request is rejected', async ({ page }) => {
  const title = `US-W2 Duplicate request ${Date.now()}`;
  const req = await createPending('requester1', title);
  await login(page, 'admin');
  await openRequest(page, req.id);
  await details(page).getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog').last();

  // 1. What the rule rejects (BR-4: a reason is required).
  await dialog.getByRole('button', { name: 'Reject' }).click();
  const message = dialog.getByText('Feedback is required');
  await expect(message).toBeVisible();
  // The message names the field to correct, and the field is marked invalid for assistive technology.
  await expect(dialog.getByLabel('Feedback')).toHaveAttribute('aria-invalid', 'true');
  expect((await readRequest(req.id)).cancelled).toBe(false);

  // 2. Correct it and submit again.
  await dialog.getByLabel('Feedback').fill('Duplicate of an earlier request');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toBeHidden();
  // The only confirmation the UI gives is the row's new status: there is no message as after submit or edit
  // (usability finding U1 in docs/section-3-usability-accessibility.md).
  await expect(page.getByRole('row').filter({ hasText: title })).toContainText('Rejected');
  const stored = await readRequest(req.id);
  expect(stored.cancelled).toBe(true);
  expect(stored.cancellationReason).toBe('Duplicate of an earlier request');
});
