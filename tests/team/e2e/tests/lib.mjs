// Shared helpers for the use-case tests.
// UI actions go through the browser. Setup and read-back go through the API (fast, and it checks the
// stored postconditions independently of what the screen shows).
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect } from '@playwright/test';
import { call, USERS, PASSWORD } from '../../env/seed.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// Test-plan rule 2.2.5: start from a reset, re-seeded system. Skipped when SKIP_RESET=1.
export function resetEnvironment() {
  if (process.env.SKIP_RESET === '1') return;
  execSync('node tests/team/env/reset.mjs', { cwd: REPO, stdio: 'inherit' });
}

// One sign-in per user for the whole run. The API allows anonymous clients only 20 calls a minute per IP,
// and signing in through the login page makes several anonymous calls each time, so a UI login per test
// runs into HTTP 429. Logging in is not part of any use case, so each test starts already signed in.
// Tokens stay valid across resets: they identify the user by e-mail, and the seed recreates the same users.
const sessions = {};
async function session(user) {
  if (!sessions[user]) {
    const r = await call('POST', '/auth/signin', null, { email: USERS[user].email, password: PASSWORD, type: 'client' });
    if (r.status !== 200) throw new Error(`sign-in failed for ${user}: ${r.status} ${JSON.stringify(r.body)}`);
    sessions[user] = { accessToken: r.body.accessToken, refreshToken: r.body.refreshToken };
  }
  return sessions[user];
}
export async function apiAs(user, method, path, body) {
  return call(method, path, (await session(user)).accessToken, body);
}
// Kept for the spec files' beforeAll; sessions survive a reset, so nothing needs clearing.
export function clearTokens() {}

// ---- UI ----------------------------------------------------------------------------------------
export async function login(page, user) {
  const { accessToken, refreshToken } = await session(user);
  // The app reads its session from localStorage (frontend/src/contexts/JWTAuthContext.tsx).
  await page.addInitScript(([a, r]) => {
    window.localStorage.setItem('accessToken', a);
    window.localStorage.setItem('refreshToken', r);
  }, [accessToken, refreshToken]);
  await page.goto('/app/requests');
  await page.waitForURL(/\/app\//);
}

export const details = (page) => page.locator('.MuiDrawer-paper').last();

export async function openRequest(page, id) {
  await page.goto(`/app/requests/${id}`);
  await expect(details(page)).toBeVisible();
}

export async function fillNewRequest(page, { title, description, priority }) {
  await page.goto('/app/requests');
  await page.getByRole('button', { name: 'Request', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (title !== undefined) await dialog.locator('input[name="title"]').fill(title);
  if (description !== undefined) await dialog.locator('[name="description"]').first().fill(description);
  if (priority) {
    await dialog.getByLabel('Priority').click();
    await page.getByRole('option', { name: priority, exact: true }).click();
  }
  return dialog;
}

// Status shown in the Requests list for the row with this title.
export async function listStatus(page, title) {
  await page.goto('/app/requests');
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  return row;
}

// ---- API setup and read-back ---------------------------------------------------------------------
export async function createPending(owner = 'requester1', title = `E2E request ${Date.now()}`) {
  const r = await apiAs(owner, 'POST', '/requests', { title, description: 'Created for a use-case test', priority: 'LOW' });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
export async function readRequest(id) {
  return (await apiAs('admin', 'GET', `/requests/${id}`)).body;
}
export async function workOrdersFor(requestId) {
  const r = await apiAs('admin', 'POST', '/work-orders/search', { filterFields: [], pageNum: 0, pageSize: 200, direction: 'DESC', sortField: 'id' });
  return (r.body.content ?? []).filter((wo) => wo.parentRequest?.id === requestId);
}
export async function myRequestTitles(user) {
  const r = await apiAs(user, 'POST', '/requests/search', { filterFields: [], pageNum: 0, pageSize: 200, direction: 'DESC', sortField: 'id' });
  return (r.body.content ?? []).map((x) => x.title);
}
