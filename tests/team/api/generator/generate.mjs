// Test-data generator: reads our OpenAPI spec and writes equivalence-partitioning (EP) classes and
// 3-point boundary values (BVA) for every input of every operation.
//
// Usage (from tests/team/api):  node generator/generate.mjs [spec.yaml] [out.json]
// Defaults: openapi.yaml -> generated/test-data.json
//
// Rules applied, per input:
//   required           -> EP invalid "missing" and (for body fields) "null"
//   type string        -> EP invalid: a number instead of a string (JSON body only)
//   minLength n        -> BVA n-1 (invalid, if n > 0), n, n+1
//   maxLength m        -> BVA m-1, m, m+1 (invalid)
//   pattern '\S'       -> EP invalid "whitespace only"
//   enum [..]          -> EP valid: every member; EP invalid: unknown member, wrong case, empty string
//   integer minimum k  -> BVA k-1 (invalid), k, k+1; EP invalid: negative, non-numeric, decimal
// Every case changes exactly ONE input of an otherwise valid request (the "base" values), so a rejected
// case can only be caused by that input.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { parse } from 'yaml';

const specFile = process.argv[2] ?? 'openapi.yaml';
const outFile = process.argv[3] ?? 'generated/test-data.json';
const specText = readFileSync(specFile, 'utf8');
const spec = parse(specText);

const resolve = (node) => {
  if (node && node.$ref) {
    const path = node.$ref.replace(/^#\//, '').split('/');
    return resolve(path.reduce((o, k) => o[k], spec));
  }
  return node;
};

const str = (n) => 'A'.repeat(n);
// Valid representative values for each kind of input, used as the "base" request.
function typical(name, schema) {
  if (schema.enum) return schema.enum.includes('MEDIUM') ? 'MEDIUM' : schema.enum[0];
  if (schema.type === 'integer') return 1;
  if (name === 'title') return 'Leaking tap in Room 101';
  if (name === 'reason') return 'Duplicate of an existing request';
  return 'Water is dripping under the sink';
}

function casesFor(location, name, schemaIn, required) {
  const schema = resolve(schemaIn);
  const cases = [];
  const add = (technique, cls, value, valid) => cases.push({ technique, class: cls, value, valid });

  if (schema.enum) {
    for (const v of schema.enum) add('EP', `valid: enum member ${v}`, v, true);
    add('EP', 'invalid: not a member', 'URGENT', false);
    add('EP', 'invalid: wrong case', String(schema.enum[schema.enum.length - 1]).toLowerCase(), false);
    add('EP', 'invalid: empty string', '', false);
  } else if (schema.type === 'string') {
    add('EP', 'valid: typical value', typical(name, schema), true);
    // Query and path values always arrive as text, so a 'wrong JSON type' class only exists in a body.
    if (location === 'body') add('EP', 'invalid: number instead of string', 12345, false);
    if (schema.pattern === '\\S') add('EP', 'invalid: whitespace only', '   ', false);
    if (schema.minLength !== undefined) {
      const n = schema.minLength;
      if (n > 0) add('BVA', `length ${n - 1} (just below minLength ${n})`, str(n - 1), false);
      add('BVA', `length ${n} (at minLength)`, str(n), true);
      add('BVA', `length ${n + 1} (just above minLength)`, str(n + 1), true);
    } else if (!required) {
      add('EP', 'valid: empty optional string', '', true);
    }
    if (schema.maxLength !== undefined) {
      const m = schema.maxLength;
      add('BVA', `length ${m - 1} (just below maxLength ${m})`, str(m - 1), true);
      add('BVA', `length ${m} (at maxLength)`, str(m), true);
      add('BVA', `length ${m + 1} (just above maxLength)`, str(m + 1), false);
    }
  } else if (schema.type === 'integer') {
    const k = schema.minimum ?? 0;
    add('BVA', `${k - 1} (just below minimum ${k})`, k - 1, false);
    add('BVA', `${k} (at minimum)`, k, true);
    add('BVA', `${k + 1} (just above minimum)`, k + 1, true);
    add('EP', 'invalid: negative', -5, false);
    add('EP', 'invalid: not a number', 'abc', false);
    add('EP', 'invalid: decimal', '1.5', false);
  }
  if (required) {
    add('EP', 'invalid: missing', { $omit: true }, false);
    if (location === 'body') add('EP', 'invalid: null', null, false);
  }
  return cases.map((c, i) => ({ id: `${location}.${name}.${String(i + 1).padStart(2, '0')}`, location, name, ...c }));
}

const out = {
  spec: specFile,
  specSha256: createHash('sha256').update(specText).digest('hex').slice(0, 16),
  generatedAt: new Date().toISOString(),
  operations: {},
};
let total = 0;
for (const [path, item] of Object.entries(spec.paths)) {
  const shared = item.parameters ?? [];
  for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
    const op = item[method];
    if (!op) continue;
    const params = [...shared, ...(op.parameters ?? [])].map(resolve);
    const inputs = [];
    const base = { path: {}, query: {}, body: {} };
    for (const p of params) {
      const schema = resolve(p.schema);
      base[p.in][p.name] = typical(p.name, schema);
      inputs.push(...casesFor(p.in, p.name, schema, !!p.required));
    }
    const bodySchema = resolve(op.requestBody?.content?.['application/json']?.schema);
    if (bodySchema?.properties) {
      for (const [name, propSchema] of Object.entries(bodySchema.properties)) {
        const required = (bodySchema.required ?? []).includes(name);
        // The base request carries a valid value for EVERY property, as a real client (the UI form) does.
        base.body[name] = typical(name, resolve(propSchema));
        inputs.push(...casesFor('body', name, propSchema, required));
      }
    }
    total += inputs.length;
    out.operations[op.operationId] = {
      method: method.toUpperCase(),
      path,
      responses: Object.keys(op.responses),
      base,
      cases: inputs,
    };
  }
}
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`${total} cases for ${Object.keys(out.operations).length} operations -> ${outFile} (spec ${out.specSha256})`);
for (const [id, op] of Object.entries(out.operations)) {
  const v = op.cases.filter((c) => c.valid).length;
  console.log(`  ${id.padEnd(15)} ${op.method.padEnd(5)} ${op.path.padEnd(24)} ${op.cases.length} cases (${v} valid, ${op.cases.length - v} invalid)`);
}
