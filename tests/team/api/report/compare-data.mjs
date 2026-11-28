// Shows the effect of a spec change on the generated data: cases added, removed and changed.
// Usage: node report/compare-data.mjs generated/test-data.json demo/test-data.changed.json
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const key = (op, c) => `${op} ${c.location}.${c.name} [${c.technique}] ${c.class}`;
const flat = (d) => new Map(Object.entries(d.operations).flatMap(([op, o]) => o.cases.map((c) => [key(op, c), c])));
const A = flat(a), B = flat(b);
const show = (v) => (typeof v === 'string' && v.length > 12 ? `"${v.slice(0, 3)}…" (${v.length} chars)` : JSON.stringify(v));
console.log(`before: ${A.size} cases (spec ${a.specSha256})   after: ${B.size} cases (spec ${b.specSha256})`);
for (const [k, c] of B) if (!A.has(k)) console.log(`  + ${k} -> ${show(c.value)} ${c.valid ? 'valid' : 'invalid'}`);
for (const [k, c] of A) if (!B.has(k)) console.log(`  - ${k} -> ${show(c.value)} ${c.valid ? 'valid' : 'invalid'}`);
