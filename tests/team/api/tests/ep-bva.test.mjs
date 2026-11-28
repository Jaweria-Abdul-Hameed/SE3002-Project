// API-EP-BVA: every case produced by the generator (generated/test-data.json), sent to the real API.
// Each case changes exactly one input of an otherwise valid request.
//   valid case   -> the request is accepted, and the stored record is read back and checked
//   invalid case -> the request is rejected with the status our specification gives, and nothing changes
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resetEnvironment, api, pendingRequest } from './lib/client.mjs';
import { defectFor } from './lib/known-defects.mjs';

before(() => resetEnvironment(), { timeout: 360_000 });

const data = JSON.parse(readFileSync(new URL('../generated/test-data.json', import.meta.url)));
const OMIT = (v) => v && typeof v === 'object' && v.$omit;

// Expected status for a rejected case, from openapi.yaml.
function expectedRejection(opId, c) {
  if (opId === 'rejectRequest' && c.name === 'reason') return OMIT(c.value) ? 400 : 406; // A-4 / BR-4
  if (c.location === 'path' && OMIT(c.value)) return 'no-route';
  return 400;
}

// Which user performs each operation, and on whose request.
const ACTOR = { createRequest: 'requester1', getRequest: 'requester1', editRequest: 'requester1', approveRequest: 'admin', rejectRequest: 'admin' };

function build(op, c, targetId) {
  const body = { ...op.base.body };
  const query = { ...op.base.query };
  let id = targetId;
  if (c.location === 'body') { if (OMIT(c.value)) delete body[c.name]; else body[c.name] = c.value; }
  if (c.location === 'query') { if (OMIT(c.value)) delete query[c.name]; else query[c.name] = c.value; }
  if (c.location === 'path') id = OMIT(c.value) ? '' : c.value;
  return { body, query, id };
}

async function send(opId, req, input) {
  const user = ACTOR[opId];
  switch (opId) {
    case 'createRequest': return api.createRequest(user, req.body, input);
    case 'getRequest': return api.getRequest(user, req.id, input);
    case 'editRequest': return api.editRequest(user, req.id, req.body, input);
    case 'approveRequest': return api.approveRequest(user, req.id, req.body, input);
    case 'rejectRequest': return api.rejectRequest(user, req.id, req.query, input);
  }
}

for (const [opId, op] of Object.entries(data.operations)) {
  describe(`${op.method} ${op.path} (${opId})`, () => {
    for (const c of op.cases) {
      const key = `${opId}|${c.id}`;
      const name = `API-${c.id} [${c.technique}] ${c.class}`;
      test(name, { todo: defectFor(key) }, async () => {
        // Every case except "create" acts on its own fresh pending request (owned by requester1).
        const target = opId === 'createRequest' ? null : await pendingRequest('requester1');
        const req = build(op, c, target?.id);
        const input = { location: c.location, name: c.name, class: c.class, valid: c.valid };
        const res = await send(opId, req, input);

        if (c.valid) {
          if (c.location === 'path') {
            // Syntactically valid id: whether it exists is not this case's concern; it must not be a 400 or a 5xx.
            assert.ok(res.status !== 400 && res.status < 500, `valid id rejected or crashed: ${res.status}`);
            return;
          }
          assert.equal(res.status, 200, `valid input refused: ${JSON.stringify(res.body).slice(0, 200)}`);
          // Read back the shared record.
          if (opId === 'createRequest' || opId === 'editRequest') {
            const id = opId === 'createRequest' ? res.body.id : target.id;
            const back = await api.getRequest('requester1', id);
            assert.equal(back.status, 200);
            if (c.location === 'body') assert.equal(back.body[c.name], c.value, `${c.name} not stored as sent`);
            assert.equal(back.body.cancelled, false);
            assert.equal(back.body.workOrder ?? null, null);
          }
          if (opId === 'approveRequest') {
            assert.equal(res.body.status, 'OPEN');
            const back = await api.getRequest('admin', target.id);
            assert.equal(back.body.workOrder?.id, res.body.id, 'request not linked to the new work order');
          }
          if (opId === 'rejectRequest') {
            const back = await api.getRequest('admin', target.id);
            assert.equal(back.body.cancelled, true);
            assert.equal(back.body.cancellationReason, req.query.reason);
          }
        } else {
          const expected = expectedRejection(opId, c);
          if (expected === 'no-route') {
            assert.ok(res.status >= 400 && res.status < 500, `missing id should give a 4xx, got ${res.status}`);
          } else {
            assert.equal(res.status, expected, `expected ${expected}, got ${res.status}: ${JSON.stringify(res.body).slice(0, 160)}`);
          }
          // Read back: a rejected change leaves the target request untouched.
          if (target) {
            const back = await api.getRequest('admin', target.id);
            assert.equal(back.body.cancelled, false, 'rejected call still cancelled the request');
            assert.equal(back.body.workOrder ?? null, null, 'rejected call still created a work order');
            assert.equal(back.body.title, 'API test request', 'rejected call still changed the title');
          }
        }
      });
    }
  });
}
