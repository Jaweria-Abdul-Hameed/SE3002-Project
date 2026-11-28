// HTTP client for the API tests.
// - Signs the seeded users in once and reuses their tokens (the API allows 20 anonymous calls a minute).
// - Keeps each user under the API's limit of 100 calls a minute (RATE_LIMIT_AUTHENTICATED_SHORT), so a
//   429 never shows up as a false failure.
// - Records every call (operation, status, which input class was sent) for the API coverage report.
import { appendFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signIn, USERS } from '../../../env/seed.mjs';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const HERE = dirname(fileURLToPath(import.meta.url));
export const RESULTS = join(HERE, '..', '..', 'results');
mkdirSync(RESULTS, { recursive: true });
const LOG = join(RESULTS, 'calls.jsonl');

const MIN_GAP_MS = 700; // at most about 85 calls a minute per user
const lastCall = new Map();
const tokens = {};

export async function token(userKey) {
  if (!tokens[userKey]) tokens[userKey] = await signIn(USERS[userKey].email);
  return tokens[userKey];
}

export async function call(userKey, method, path, { body, query, operationId, input } = {}) {
  const t = userKey ? await token(userKey) : null;
  const wait = (lastCall.get(userKey) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall.set(userKey, Date.now());

  const qs = query ? '?' + Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  const res = await fetch(BASE_URL + path + qs, {
    method,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (operationId) {
    appendFileSync(LOG, JSON.stringify({ operationId, status: res.status, input: input ?? null }) + '\n');
  }
  return { status: res.status, body: json };
}

// Shortcuts for the five specified operations (operationId as in openapi.yaml).
export const api = {
  createRequest: (user, body, input) => call(user, 'POST', '/requests', { body, operationId: 'createRequest', input }),
  getRequest: (user, id, input) => call(user, 'GET', `/requests/${id}`, { operationId: 'getRequest', input }),
  editRequest: (user, id, body, input) => call(user, 'PATCH', `/requests/${id}`, { body, operationId: 'editRequest', input }),
  approveRequest: (user, id, body = {}, input) => call(user, 'PATCH', `/requests/${id}/approve`, { body, operationId: 'approveRequest', input }),
  rejectRequest: (user, id, query, input) => call(user, 'PATCH', `/requests/${id}/cancel`, { query, operationId: 'rejectRequest', input }),
};

// A fresh pending request owned by the given requester, used as the target of one test case.
export async function pendingRequest(owner = 'requester1', title = 'API test request') {
  const r = await call(owner, 'POST', '/requests', { body: { title, priority: 'LOW' } });
  if (r.status !== 200) throw new Error(`could not create a pending request: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

// Work orders whose parent is the given request (read-back of the shared record).
export async function workOrdersFor(requestId) {
  const r = await call('admin', 'POST', '/work-orders/search', {
    body: { filterFields: [], pageNum: 0, pageSize: 200, direction: 'DESC', sortField: 'id' },
  });
  return (r.body.content ?? []).filter((wo) => wo.parentRequest?.id === requestId);
}

// Test-plan rule (section 2.2.5): every suite that changes data starts from a reset and re-seeded environment,
// so BR-3's work-order count and all ids start from a known state. Skipped when SKIP_RESET=1.
export function resetEnvironment() {
  if (process.env.SKIP_RESET === '1') return;
  execSync('node tests/team/env/reset.mjs', { cwd: join(HERE, '..', '..', '..', '..', '..'), stdio: 'inherit' });
}
