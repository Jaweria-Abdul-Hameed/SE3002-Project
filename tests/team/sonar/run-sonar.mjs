// Runs SonarQube on the Atlas CMMS API and saves the metrics we report in Section 2.
// Usage, from the repository root (Docker must be running):
//   node tests/team/sonar/run-sonar.mjs            full analysis + per-method complexity probe
//   node tests/team/sonar/run-sonar.mjs --probe    only the per-method complexity probe (about 2 min)
//
// What it does
// 1. Starts a local SonarQube Community container on http://localhost:9100. Port 9000 is taken by MinIO.
// 2. Analyses api/src/main with the default "Sonar way" profile (project key se3002-atlas).
//    That gives the project metrics: complexity, duplication, code smells, bugs, vulnerabilities,
//    coverage, technical debt and ratings.
// 3. Analyses RequestService and WorkOrderService again in a separate project (se3002-cc-probe). Its
//    profile turns on rule java:S1541 with a threshold of 1, so SonarQube reports the cyclomatic
//    complexity of every single method. Normal metrics are per file only.
// 4. Writes everything to docs/evidence/sonar/.
//
// The admin password is for this throwaway local container only. Override with SONAR_ADMIN_PASSWORD.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL_ = 'http://localhost:9100';
const PASS = process.env.SONAR_ADMIN_PASSWORD ?? 'Se3002-Sonar-Local!1';
const IMAGE = 'sonarqube:community';
const CONTAINER = 'se3002-sonar';
const MAIN_KEY = 'se3002-atlas';
const PROBE_KEY = 'se3002-cc-probe';
const PROBE_PROFILE = 'SE3002 CC probe';
const OUT = resolve('docs/evidence/sonar');
const probeOnly = process.argv.includes('--probe');

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
const auth = (user, pw) => 'Basic ' + Buffer.from(`${user}:${pw}`).toString('base64');
let AUTH = auth('admin', PASS);
async function api(method, path, form, attempt = 1) {
  let res;
  try {
    res = await fetch(URL_ + path, {
      method,
      headers: { Authorization: AUTH, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
  } catch (e) {
    // A kept-alive connection can be closed by SonarQube while a long scan runs; retry on a fresh one.
    if (attempt < 3) return api(method, path, form, attempt + 1);
    throw e;
  }
  const text = await res.text();
  if (!res.ok && res.status !== 400) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// 1. Container
const existing = sh(`docker ps -a --filter name=^${CONTAINER}$ --format "{{.Status}}"`).trim();
if (!existing) sh(`docker run -d --name ${CONTAINER} -p 9100:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true ${IMAGE}`);
else if (!existing.startsWith('Up')) sh(`docker start ${CONTAINER}`);
process.stdout.write('Waiting for SonarQube');
for (let i = 0; ; i++) {
  try { if ((await (await fetch(`${URL_}/api/system/status`)).json()).status === 'UP') break; } catch {}
  if (i > 100) throw new Error('SonarQube did not start');
  process.stdout.write('.'); await new Promise((r) => setTimeout(r, 3000));
}
const version = (await (await fetch(`${URL_}/api/system/status`)).json()).version;
console.log(` up (SonarQube ${version})`);

// 2. First run only: replace the default admin/admin password.
const probeAuth = await fetch(`${URL_}/api/authentication/validate`, { headers: { Authorization: AUTH } });
if (!(await probeAuth.json()).valid) {
  AUTH = auth('admin', 'admin');
  await api('POST', '/api/users/change_password', { login: 'admin', previousPassword: 'admin', password: PASS });
  AUTH = auth('admin', PASS);
}
const token = (await api('POST', '/api/user_tokens/generate', { name: `run-${Date.now()}`, type: 'GLOBAL_ANALYSIS_TOKEN' })).token;

// 3. Probe project with S1541 threshold 1 (created once).
const profiles = await api('GET', `/api/qualityprofiles/search?language=java`);
if (!profiles.profiles.some((p) => p.name === PROBE_PROFILE)) {
  const def = profiles.profiles.find((p) => p.isDefault);
  await api('POST', '/api/qualityprofiles/copy', { fromKey: def.key, toName: PROBE_PROFILE });
}
const probeKey = (await api('GET', `/api/qualityprofiles/search?language=java`)).profiles.find((p) => p.name === PROBE_PROFILE).key;
await api('POST', '/api/qualityprofiles/activate_rule', { key: probeKey, rule: 'java:S1541', params: 'Threshold=1' });
const projects = await api('GET', `/api/projects/search?projects=${PROBE_KEY}`);
if (!projects.components.length) await api('POST', '/api/projects/create', { project: PROBE_KEY, name: 'SE3002 complexity probe' });
await api('POST', '/api/qualityprofiles/add_project', { language: 'java', qualityProfile: PROBE_PROFILE, project: PROBE_KEY });

// 4. Analyses run inside the Maven image, so no local Java is needed. Test sources are not analysed:
//    upstream's tests are not ours. Our own coverage is reported from Section 2.3 onwards.
const scan = (extra) => {
  const cmd = `docker run --rm -v se3002-m2:/root/.m2 -v "${resolve('api')}:/src" -w /src maven:3.9-eclipse-temurin-17 ` +
    `mvn -B -q -DskipTests compile org.sonarsource.scanner.maven:sonar-maven-plugin:5.1.0.4751:sonar ` +
    `-Dsonar.host.url=http://host.docker.internal:9100 -Dsonar.token=${token} -Dsonar.tests= ${extra}`;
  console.log(`> mvn sonar ${extra}`);
  sh(cmd, { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
};
const started = Date.now();
if (!probeOnly) scan(`-Dsonar.projectKey=${MAIN_KEY} -Dsonar.projectName=Atlas-CMMS-API`);
scan(`-Dsonar.projectKey=${PROBE_KEY} -Dsonar.projectName=SE3002-complexity-probe "-Dsonar.inclusions=**/service/RequestService.java,**/service/WorkOrderService.java"`);

// 5. Wait for SonarQube to finish processing, then collect results.
for (const key of probeOnly ? [PROBE_KEY] : [MAIN_KEY, PROBE_KEY]) {
  for (let i = 0; ; i++) {
    const q = await api('GET', `/api/ce/component?component=${key}`);
    if (!q.queue?.length && q.current?.status === 'SUCCESS') break;
    if (q.current?.status === 'FAILED' || i > 200) throw new Error(`analysis of ${key} failed`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString();
const metricKeys = 'ncloc,functions,complexity,cognitive_complexity,duplicated_lines_density,duplicated_blocks,code_smells,bugs,vulnerabilities,security_hotspots,coverage,sqale_index,sqale_debt_ratio,sqale_rating,reliability_rating,security_rating,security_review_rating';
if (!probeOnly) {
  const m = await api('GET', `/api/measures/component?component=${MAIN_KEY}&metricKeys=${metricKeys}`);
  const metrics = Object.fromEntries(m.component.measures.map((x) => [x.metric, x.value]));
  writeFileSync(`${OUT}/project-metrics.json`, JSON.stringify({ sonarqube: version, analysedAt: stamp, project: MAIN_KEY, metrics }, null, 2));
  console.log('Project metrics:', metrics);
}
const issues = await api('GET', `/api/issues/search?componentKeys=${PROBE_KEY}&rules=java:S1541&ps=500`);
const methods = issues.issues.map((i) => {
  const [, name, cc] = i.message.match(/method "(.+?)" is (\d+)/);
  return { file: i.component.split('/').pop(), line: i.line, method: name, cyclomaticComplexity: Number(cc) };
}).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
writeFileSync(`${OUT}/method-complexity.json`, JSON.stringify({ sonarqube: version, analysedAt: stamp, rule: 'java:S1541 (threshold 1)', methods }, null, 2));
console.log('cancel():', methods.find((x) => x.file === 'RequestService.java' && x.method === 'cancel'));
console.log(`Done in ${Math.round((Date.now() - started) / 60000)} min. Results in docs/evidence/sonar/. Dashboard: ${URL_}/dashboard?id=${MAIN_KEY}`);
