// API-BR3: 3-point boundary of the work-order limit through the real API (BR-3, FR-10).
// The limit is 30 INCOMPLETE work orders per company. After a reset there are none, so the suite builds up
// exactly 29, then probes the boundary. Each approval creates one incomplete work order.
//   API-BR3-01  29 incomplete -> approve allowed (the 30th)
//   API-BR3-02  30 incomplete -> approve refused 403; the request stays pending (read back)
//   API-BR3-03  one work order completed (back to 29) -> the refused request can now be approved
// A 31st incomplete work order cannot be reached through the API (the limit prevents it); "just above"
// is covered at unit level (UT-BR3-03).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvironment, api, call, pendingRequest } from './lib/client.mjs';

before(() => resetEnvironment(), { timeout: 360_000 });

describe('BR-3 work-order limit (30 incomplete)', () => {
  let refusedId;

  test('setup: 29 approved requests', { timeout: 300_000 }, async () => {
    // Alternate requesters and reviewers so that no single user goes over the API rate limit.
    for (let i = 0; i < 29; i++) {
      const req = await pendingRequest(i % 2 ? 'requester2' : 'requester1', `BR-3 fill ${i + 1}`);
      const res = await api.approveRequest(i % 2 ? 'limitedAdmin' : 'admin', req.id);
      assert.equal(res.status, 200, `approval ${i + 1} failed: ${res.status}`);
    }
  });

  test('API-BR3-01 29 incomplete work orders -> approve allowed (30th created)', async () => {
    const req = await pendingRequest('requester1', 'BR-3 the 30th');
    const res = await api.approveRequest('admin', req.id, {}, { location: 'state', name: 'incomplete work orders', class: '29 (just below the limit)', valid: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'OPEN');
  });

  test('API-BR3-02 30 incomplete work orders -> approve refused 403, request stays pending', async () => {
    const req = await pendingRequest('requester2', 'BR-3 the 31st');
    refusedId = req.id;
    const res = await api.approveRequest('limitedAdmin', req.id, {}, { location: 'state', name: 'incomplete work orders', class: '30 (at the limit)', valid: false });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Free Limit of 30 incomplete work orders reached/);
    const back = (await api.getRequest('admin', req.id)).body;
    assert.equal(back.workOrder ?? null, null, 'refused approval still linked a work order');
    assert.equal(back.cancelled, false);
  });

  test('API-BR3-03 one work order completed (29 incomplete again) -> the refused request can be approved', async () => {
    const list = await call('admin', 'POST', '/work-orders/search', {
      body: { filterFields: [], pageNum: 0, pageSize: 5, direction: 'ASC', sortField: 'id' },
    });
    const first = list.body.content[0];
    const done = await call('admin', 'PATCH', `/work-orders/${first.id}/change-status`, { body: { status: 'COMPLETE' } });
    assert.equal(done.status, 200, `could not complete work order ${first.id}: ${JSON.stringify(done.body).slice(0, 160)}`);
    const res = await api.approveRequest('admin', refusedId, {}, { location: 'state', name: 'incomplete work orders', class: '29 after completing one', valid: true });
    assert.equal(res.status, 200);
  });
});
