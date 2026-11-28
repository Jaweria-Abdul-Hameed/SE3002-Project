// API-RULE / API-STATE: business rules through the real API, with read-back of the shared records.
//   BR-1 decision table (approve and reject x three roles)
//   BR-2 state transitions: every allowed change, and the disallowed changes from each state
//   Repeated requests: deciding twice, one after the other and at the same time, never makes duplicates
//   A-3: PATCH keeps the fields it was not sent
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvironment, api, pendingRequest, workOrdersFor } from './lib/client.mjs';
import { defectFor } from './lib/known-defects.mjs';

before(() => resetEnvironment(), { timeout: 360_000 });

const read = async (id) => (await api.getRequest('admin', id)).body;

describe('BR-1 decision table: SETTINGS || LIMITED_ADMIN', () => {
  // A = role views SETTINGS, B = role code is LIMITED_ADMIN. A=T,B=T cannot be reached with real roles (Section 1).
  const rows = [
    { id: 'API-BR1-01', user: 'admin', a: 'T', b: 'F', allowed: true },
    { id: 'API-BR1-02', user: 'limitedAdmin', a: 'F', b: 'T', allowed: true },
    { id: 'API-BR1-03', user: 'requester2', a: 'F', b: 'F', allowed: false },
  ];
  for (const r of rows) {
    test(`${r.id}a approve as ${r.user} (A=${r.a}, B=${r.b}) -> ${r.allowed ? '200, work order created' : '403, nothing changes'}`, async () => {
      const req = await pendingRequest('requester1');
      const res = await api.approveRequest(r.user, req.id, {}, { location: 'role', name: r.user, class: `A=${r.a},B=${r.b}`, valid: r.allowed });
      const back = await read(req.id);
      if (r.allowed) {
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'OPEN');
        assert.equal(back.workOrder?.id, res.body.id);
      } else {
        assert.equal(res.status, 403);
        assert.equal(back.workOrder ?? null, null);
        assert.equal((await workOrdersFor(req.id)).length, 0);
      }
    });
    test(`${r.id}b reject as ${r.user} (A=${r.a}, B=${r.b}) -> ${r.allowed ? '200, cancelled' : '403, nothing changes'}`, async () => {
      const req = await pendingRequest('requester1');
      const res = await api.rejectRequest(r.user, req.id, { reason: 'Duplicate' }, { location: 'role', name: r.user, class: `A=${r.a},B=${r.b}`, valid: r.allowed });
      const back = await read(req.id);
      assert.equal(res.status, r.allowed ? 200 : 403);
      assert.equal(back.cancelled, r.allowed);
      assert.equal(back.cancellationReason ?? null, r.allowed ? 'Duplicate' : null);
    });
  }
});

describe('BR-2 state transitions (Pending, Approved, Rejected)', () => {
  test('API-ST-01 Pending -> Approved (approve): allowed', async () => {
    const req = await pendingRequest();
    assert.equal((await api.approveRequest('admin', req.id)).status, 200);
    assert.ok((await read(req.id)).workOrder);
  });
  test('API-ST-02 Pending -> Rejected (reject): allowed', async () => {
    const req = await pendingRequest();
    assert.equal((await api.rejectRequest('admin', req.id, { reason: 'Not needed' })).status, 200);
    assert.equal((await read(req.id)).cancelled, true);
  });
  test('API-ST-03 Pending -> Pending (edit by creator): allowed', async () => {
    const req = await pendingRequest();
    const res = await api.editRequest('requester1', req.id, { title: 'Edited title', description: 'd', priority: 'HIGH' });
    assert.equal(res.status, 200);
    const back = await read(req.id);
    assert.equal(back.title, 'Edited title');
    assert.equal(back.cancelled, false);
    assert.equal(back.workOrder ?? null, null);
  });

  async function approved() {
    const req = await pendingRequest();
    const wo = await api.approveRequest('admin', req.id);
    return { req, woId: wo.body.id };
  }
  test('API-ST-04 Approved -> approve again: refused 406, still one work order', async () => {
    const { req, woId } = await approved();
    const res = await api.approveRequest('admin', req.id);
    assert.equal(res.status, 406);
    assert.equal((await read(req.id)).workOrder?.id, woId);
    assert.equal((await workOrdersFor(req.id)).length, 1);
  });
  test('API-ST-05 Approved -> reject: refused 406, not cancelled', async () => {
    const { req } = await approved();
    const res = await api.rejectRequest('admin', req.id, { reason: 'Too late' });
    assert.equal(res.status, 406);
    const back = await read(req.id);
    assert.equal(back.cancelled, false);
    assert.equal(back.cancellationReason ?? null, null);
  });
  test('API-ST-06 Approved -> edit: refused 406, title unchanged', async () => {
    const { req } = await approved();
    const res = await api.editRequest('requester1', req.id, { title: 'Changed after approval', description: 'd', priority: 'LOW' });
    assert.equal(res.status, 406);
    assert.equal((await read(req.id)).title, 'API test request');
  });

  async function rejected() {
    const req = await pendingRequest();
    await api.rejectRequest('admin', req.id, { reason: 'First reason' });
    return req;
  }
  test('API-ST-07 Rejected -> approve: should be refused 406, no work order (A-1)', { todo: defectFor('state|Rejected -> approve') }, async () => {
    const req = await rejected();
    const res = await api.approveRequest('admin', req.id);
    assert.equal(res.status, 406);
    assert.equal((await read(req.id)).workOrder ?? null, null);
    assert.equal((await workOrdersFor(req.id)).length, 0);
  });
  test('API-ST-08 Rejected -> reject again: should be refused 406, first reason kept (A-1)', { todo: defectFor('state|Rejected -> reject again') }, async () => {
    const req = await rejected();
    const res = await api.rejectRequest('admin', req.id, { reason: 'Second reason' });
    assert.equal(res.status, 406);
    assert.equal((await read(req.id)).cancellationReason, 'First reason');
  });
  test('API-ST-09 Rejected -> edit: should be refused 406 (A-1)', { todo: defectFor('state|Rejected -> edit') }, async () => {
    const req = await rejected();
    const res = await api.editRequest('requester1', req.id, { title: 'Edited after rejection', description: 'd', priority: 'LOW' });
    assert.equal(res.status, 406);
    assert.equal((await read(req.id)).title, 'API test request');
  });
});

describe('Repeated requests create no duplicates', () => {
  test('API-REP-01 the same approval sent twice at the same moment (5 tries) -> never two work orders', { todo: defectFor('race|concurrent approvals') }, async () => {
    // Two reviewers (Admin and Limited Admin) press Approve at the same time. The BR-2 guard
    // (getWorkOrder() != null) has no lock, so both can pass it. The race is intermittent, hence 5 tries.
    const duplicates = [];
    for (let i = 0; i < 5; i++) {
      const req = await pendingRequest();
      const [a, b] = await Promise.all([api.approveRequest('admin', req.id), api.approveRequest('limitedAdmin', req.id)]);
      const wos = await workOrdersFor(req.id);
      if (wos.length !== 1) duplicates.push(`request ${req.id}: statuses ${a.status},${b.status}, work orders ${wos.map((w) => w.id)}`);
    }
    assert.deepEqual(duplicates, [], 'duplicate work orders created');
  });
  test('API-REP-02 the same rejection sent twice -> second refused 406 (A-1)', { todo: defectFor('state|Rejected -> reject again') }, async () => {
    const req = await pendingRequest();
    assert.equal((await api.rejectRequest('admin', req.id, { reason: 'Duplicate' })).status, 200);
    assert.equal((await api.rejectRequest('admin', req.id, { reason: 'Duplicate' })).status, 406);
  });
});

describe('A-3: PATCH changes only the fields sent', () => {
  test('API-PATCH-01 editing only the title keeps description and priority', { todo: defectFor('rule|PATCH keeps fields that were not sent') }, async () => {
    const created = await api.createRequest('requester1', { title: 'Keep my fields', description: 'Keep this text', priority: 'HIGH' });
    const res = await api.editRequest('requester1', created.body.id, { title: 'Keep my fields (edited)' });
    assert.equal(res.status, 200, `partial edit refused: ${res.status}`);
    const back = await read(created.body.id);
    assert.equal(back.description, 'Keep this text');
    assert.equal(back.priority, 'HIGH');
  });
});

describe('Who may submit, read and edit (FR-03, FR-04, FR-05)', () => {
  test('API-AUTH-01 Limited Admin submits a request -> 403 (no create permission on REQUESTS)', async () => {
    const res = await api.createRequest('limitedAdmin', { title: 'Supervisor request', description: 'd', priority: 'LOW' },
      { location: 'role', name: 'limitedAdmin', class: 'no create permission', valid: false });
    assert.equal(res.status, 403);
  });
  test('API-AUTH-02 another requester reads the request -> 403', async () => {
    const req = await pendingRequest('requester1');
    const res = await api.getRequest('requester2', req.id, { location: 'role', name: 'requester2', class: 'not the creator', valid: false });
    assert.equal(res.status, 403);
  });
  test('API-AUTH-03 another requester edits the request -> 403, title unchanged', async () => {
    const req = await pendingRequest('requester1');
    const res = await api.editRequest('requester2', req.id, { title: 'Hijacked', description: 'd', priority: 'LOW' },
      { location: 'role', name: 'requester2', class: 'not the creator', valid: false });
    assert.equal(res.status, 403);
    assert.equal((await read(req.id)).title, 'API test request');
  });
});
