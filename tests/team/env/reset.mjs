// Resets the application to an empty state and re-seeds the fixed test data.
// Usage, from the repository root:  node tests/team/env/reset.mjs
// Deletes the Postgres and MinIO volumes, starts the stack again (built from baseline source),
// waits until the API answers, then runs seed.mjs.
import { execSync } from 'node:child_process';
import { BASE_URL, seed } from './seed.mjs';

const compose = 'docker compose -f docker-compose.yml -f docker-compose.source.yml';
const run = (cmd) => { console.log(`> ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

run(`${compose} down -v`);
run(`${compose} up -d`);

process.stdout.write('Waiting for the API');
const started = Date.now();
for (;;) {
  try {
    // Any 4xx answer means Spring is up; 502/503 or a refused connection means it is still starting.
    const r = await fetch(`${BASE_URL}/auth/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (r.status >= 400 && r.status < 500) break;
  } catch { /* not listening yet */ }
  if (Date.now() - started > 300_000) { console.error('\nAPI did not start within 5 minutes'); process.exit(1); }
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 3000));
}
console.log(` ready after ${Math.round((Date.now() - started) / 1000)} s`);
await seed();
