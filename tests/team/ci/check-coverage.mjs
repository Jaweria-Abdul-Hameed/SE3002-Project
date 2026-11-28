// Exit criterion EX-2 (docs/section-2-2-test-plan.md): 100 % statement (line) and branch coverage of the
// in-scope business-logic methods, including the lambdas written inside them.
// Usage: node tests/team/ci/check-coverage.mjs [path/to/jacoco.xml]
// Exits with 1 if any in-scope method misses a line or a branch, so the CI job fails.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'api/target/site/jacoco/jacoco.xml';
const xml = readFileSync(file, 'utf8');

// Methods in scope (docs/section-1-scope-and-test-basis.md §1.7). Lambdas compiled from inside a method are named
// lambda$<method>$N, so they are included through the pattern.
const SCOPE = {
  'com/grash/service/RequestService': [
    'create', 'getById', 'patch', 'approve', 'approveFromWorkflow', 'approveInternal', 'cancel',
    'createWorkOrderFromRequest',
  ],
  'com/grash/service/WorkOrderService': ['checkUsageBasedLimit'],
};
// Overloads that are out of scope: create(Request, Company, RequestPortal) belongs to the public request portal.
const EXCLUDED_DESC = [/^\(Lcom\/grash\/model\/Request;Lcom\/grash\/model\/Company;Lcom\/grash\/model\/RequestPortal;\)/];

let failed = 0;
let checked = 0;
for (const [, className, body] of xml.matchAll(/<class name="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g)) {
  const methods = SCOPE[className];
  if (!methods) continue;
  for (const [, name, desc, line, inner] of body.matchAll(/<method name="([^"]+)" desc="([^"]+)" line="(\d+)">([\s\S]*?)<\/method>/g)) {
    const base = name.startsWith('lambda$') ? name.split('$')[1] : name;
    if (!methods.includes(base) || EXCLUDED_DESC.some((re) => re.test(desc))) continue;
    const counter = (type) => {
      const m = inner.match(new RegExp(`<counter type="${type}" missed="(\\d+)" covered="(\\d+)"/>`));
      return m ? { missed: +m[1], covered: +m[2] } : { missed: 0, covered: 0 };
    };
    const l = counter('LINE');
    const b = counter('BRANCH');
    checked++;
    const ok = l.missed === 0 && b.missed === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${className.split('/').pop()}.${name} (line ${line}): ` +
      `lines ${l.covered}/${l.missed + l.covered}, branches ${b.covered}/${b.missed + b.covered}`);
  }
}
if (checked === 0) { console.error('No in-scope methods found in ' + file); process.exit(1); }
console.log(`\n${checked} in-scope methods checked, ${failed} below 100 %.`);
process.exit(failed ? 1 : 0);
