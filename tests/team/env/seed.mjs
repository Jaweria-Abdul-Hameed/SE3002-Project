// Seeds the fixed test data for the Requests -> Work Orders module through the public API.
// Usage (app must be running and freshly reset):  node tests/team/env/seed.mjs
// Optional: BASE_URL=http://localhost:3000/api node tests/team/env/seed.mjs
//
// Creates one company and four users. Only ADMIN and LIMITED_ADMIN are paid roles, so this uses
// 2 of the 5 paid seats the free tier allows across the whole instance. Requesters are free.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
export const PASSWORD = 'Se3002-Test-Pass!'; // synthetic; 17 chars (signup requires at least 12)
export const COMPANY = 'SE3002 Test Facility';
export const USERS = {
  admin: { email: 'admin@se3002.test', firstName: 'Ayesha', lastName: 'Admin', role: 'ADMIN' },
  limitedAdmin: { email: 'limited.admin@se3002.test', firstName: 'Bilal', lastName: 'Supervisor', role: 'LIMITED_ADMIN' },
  requester1: { email: 'requester1@se3002.test', firstName: 'Sara', lastName: 'Requester', role: 'REQUESTER' },
  requester2: { email: 'requester2@se3002.test', firstName: 'Umar', lastName: 'Requester', role: 'REQUESTER' },
};

export async function call(method, path, token, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

export async function signIn(email) {
  const r = await call('POST', '/auth/signin', null, { email, password: PASSWORD, type: 'client' });
  if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}

function fail(step, r) {
  console.error(`FAILED at ${step}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
  if (r.status === 422) console.error('The data already exists. Reset first: node tests/team/env/reset.mjs');
  process.exit(1);
}

export async function seed() {
  const a = USERS.admin;
  // 1. The first sign-up without a role creates the company and makes that user its ADMIN.
  const signup = await call('POST', '/auth/signup', null, {
    email: a.email, password: PASSWORD, firstName: a.firstName, lastName: a.lastName,
    phone: '0000000000', companyName: COMPANY, employeesCount: 10, language: 'EN',
  });
  if (signup.status !== 200) fail('admin sign-up', signup);
  const adminToken = await signIn(a.email);

  // 2. Other users must be invited for a role first, then sign up with that role (same as the UI's invite form).
  const roles = await call('GET', '/roles', adminToken);
  if (roles.status !== 200) fail('list roles', roles);
  const roleId = (code) => roles.body.find((r) => r.code === code).id;
  for (const key of ['limitedAdmin', 'requester1', 'requester2']) {
    const u = USERS[key];
    const inv = await call('POST', '/users/invite', adminToken,
      { role: { id: roleId(u.role) }, emails: [u.email], disableSendingEmail: true });
    if (inv.status !== 200) fail(`invite ${u.email}`, inv);
    const s = await call('POST', '/auth/signup', null, {
      email: u.email, password: PASSWORD, firstName: u.firstName, lastName: u.lastName,
      phone: '0000000000', role: { id: roleId(u.role) },
    });
    if (s.status !== 200) fail(`sign-up ${u.email}`, s);
  }

  const summary = Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, { email: u.email, role: u.role }]));
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'seeded-users.json'),
    JSON.stringify({ company: COMPANY, password: PASSWORD, users: summary }, null, 2));
  console.log(`Seeded company "${COMPANY}" with users (password: ${PASSWORD}):`);
  for (const u of Object.values(USERS)) console.log(`  ${u.role.padEnd(13)} ${u.email}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await seed();
