// API coverage report, computed from results/calls.jsonl (written by the test client) against openapi.yaml.
// Criteria (black-box API coverage, input and output side):
//   path coverage           every path in the spec was called
//   operation coverage      every operation (path + method) was called
//   parameter coverage      every parameter and body property was sent at least once by a generated case
//   parameter value cov.    every enum member was sent; every generated EP class / BVA value was sent
//   content-type coverage   every request content type (application/json) was used
//   status-code coverage    every documented response code was observed
// Usage (from tests/team/api): node report/api-coverage.mjs  -> results/api-coverage.json and a summary
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

const spec = parse(readFileSync('openapi.yaml', 'utf8'));
const data = JSON.parse(readFileSync('generated/test-data.json', 'utf8'));
const calls = readFileSync('results/calls.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const ops = Object.entries(data.operations);
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 100);
const result = { generatedFromCalls: calls.length, criteria: {} };

// Paths and operations
const calledOps = new Set(calls.map((c) => c.operationId));
const paths = Object.keys(spec.paths);
const calledPaths = new Set(ops.filter(([id]) => calledOps.has(id)).map(([, op]) => op.path));
result.criteria.path = { covered: calledPaths.size, total: paths.length };
result.criteria.operation = { covered: ops.filter(([id]) => calledOps.has(id)).length, total: ops.length };

// Parameters / properties and their values (generated cases)
let params = 0, paramsHit = 0, values = 0, valuesHit = 0;
const missingValues = [];
for (const [id, op] of ops) {
  const sent = calls.filter((c) => c.operationId === id && c.input);
  const names = [...new Set(op.cases.map((c) => `${c.location}.${c.name}`))];
  for (const n of names) {
    params++;
    if (sent.some((c) => `${c.input.location}.${c.input.name}` === n)) paramsHit++;
  }
  for (const c of op.cases) {
    values++;
    if (sent.some((s) => s.input.location === c.location && s.input.name === c.name && s.input.class === c.class)) valuesHit++;
    else missingValues.push(`${id} ${c.id} ${c.class}`);
  }
}
result.criteria.parameter = { covered: paramsHit, total: params };
result.criteria.parameterValue = { covered: valuesHit, total: values, missing: missingValues };

// Content types: every operation with a JSON body was called
const jsonOps = ops.filter(([, op]) => ['POST', 'PATCH', 'PUT'].includes(op.method) && op.cases.some((c) => c.location === 'body'));
result.criteria.contentType = { covered: jsonOps.filter(([id]) => calledOps.has(id)).length, total: jsonOps.length };

// Status codes: documented vs observed
let codes = 0, codesHit = 0;
const statusDetail = {};
for (const [id, op] of ops) {
  const observed = [...new Set(calls.filter((c) => c.operationId === id).map((c) => c.status))].sort();
  const documented = op.responses.map(Number);
  const hit = documented.filter((d) => observed.includes(d));
  codes += documented.length;
  codesHit += hit.length;
  statusDetail[id] = {
    documented,
    observed,
    documentedNotObserved: documented.filter((d) => !observed.includes(d)),
    observedNotDocumented: observed.filter((o) => !documented.includes(o)),
  };
}
result.criteria.statusCode = { covered: codesHit, total: codes, detail: statusDetail };

writeFileSync('results/api-coverage.json', JSON.stringify(result, null, 2) + '\n');
console.log(`API coverage from ${calls.length} recorded calls`);
for (const [k, v] of Object.entries(result.criteria)) console.log(`  ${k.padEnd(15)} ${v.covered}/${v.total} (${pct(v.covered, v.total)} %)`);
for (const [id, d] of Object.entries(statusDetail)) {
  console.log(`  ${id.padEnd(15)} documented ${d.documented.join(',')} | observed ${d.observed.join(',')}` +
    (d.documentedNotObserved.length ? ` | never seen: ${d.documentedNotObserved.join(',')}` : '') +
    (d.observedNotDocumented.length ? ` | undocumented: ${d.observedNotDocumented.join(',')}` : ''));
}
