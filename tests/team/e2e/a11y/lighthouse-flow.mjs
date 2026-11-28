// Section 3: Lighthouse (accessibility, best practices, SEO) on each use case's key screen, signed in.
// Uses a Lighthouse user flow driven by puppeteer-core on Playwright's Chromium:
//   screens reached by URL  -> navigation step (full page load);
//   dialogs (KS1, KS3, KS5) -> snapshot step after opening the dialog.
// Output: $A11Y_OUT/lighthouse-flow.html (the report) and lighthouse-summary.json.
// Usage (from tests/team/e2e, app running and seeded): node a11y/lighthouse-flow.mjs
// Owner: Muhammad Aun.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { startFlow } from 'lighthouse';
import { chromium } from '@playwright/test';
import { call, USERS, PASSWORD } from '../../env/seed.mjs';
import { SCREENS } from './screens.mjs';

const BASE = process.env.BASE_URL_UI ?? 'http://localhost:3000';
const OUT = resolve(process.env.A11Y_OUT ?? '../../../docs/evidence/a11y/latest');
mkdirSync(OUT, { recursive: true });

const sessions = {};
for (const u of new Set(SCREENS.map((s) => s.user))) {
  const r = await call('POST', '/auth/signin', null, { email: USERS[u].email, password: PASSWORD, type: 'client' });
  sessions[u] = r.body;
}
const pending = (await call('POST', '/requests', sessions.requester1.accessToken,
  { title: 'A11Y Lighthouse request', description: 'Key-screen audit', priority: 'LOW' })).body;

const browser = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: true, defaultViewport: { width: 1350, height: 940 } });
const page = await browser.newPage();
let signedInAs = null;
async function signIn(user) {
  if (signedInAs === user) return;
  await page.goto(BASE + '/account/login');
  await page.evaluate(([a, r]) => { localStorage.setItem('accessToken', a); localStorage.setItem('refreshToken', r); },
    [sessions[user].accessToken, sessions[user].refreshToken]);
  signedInAs = user;
}
const clickButton = async (text, within = 'body') => {
  await page.waitForFunction((t, w) => [...document.querySelector(w)?.querySelectorAll('button') ?? []].some((b) => b.innerText.trim() === t), {}, text, within);
  await page.evaluate((t, w) => [...document.querySelector(w).querySelectorAll('button')].find((b) => b.innerText.trim() === t).click(), text, within);
};

const flow = await startFlow(page, {
  name: 'SE3002 key screens (signed in)',
  config: { extends: 'lighthouse:default', settings: { onlyCategories: ['accessibility', 'best-practices', 'seo'], disableStorageReset: true, formFactor: 'desktop', screenEmulation: { disabled: true } } },
});
for (const s of SCREENS) {
  await signIn(s.user);
  const url = BASE + s.url.replace('{pending}', pending.id);
  if (!s.open) {
    await flow.navigate(url, { name: `${s.id} ${s.label}` });
  } else {
    await page.goto(url, { waitUntil: 'networkidle0' });
    if (s.open.button) await clickButton(s.open.button, s.url.includes('{pending}') ? '.MuiDrawer-paper' : 'body');
    if (s.open.editIcon) {
      await page.waitForSelector('.MuiDrawer-paper button svg[data-testid="EditTwoToneIcon"]');
      await page.evaluate(() => document.querySelector('.MuiDrawer-paper button svg[data-testid="EditTwoToneIcon"]').closest('button').click());
    }
    await page.waitForSelector('[role="dialog"]');
    await new Promise((r) => setTimeout(r, 800));
    await flow.snapshot({ name: `${s.id} ${s.label}` });
  }
}
writeFileSync(join(OUT, 'lighthouse-flow.html'), await flow.generateReport());
const result = await flow.createFlowResult();
const summary = result.steps.map((st) => ({
  step: st.name,
  mode: st.lhr.gatherMode,
  scores: Object.fromEntries(Object.entries(st.lhr.categories).map(([k, c]) => [k, c.score === null ? null : Math.round(c.score * 100)])),
  failedAccessibilityAudits: (st.lhr.categories.accessibility?.auditRefs ?? [])
    .map((r) => st.lhr.audits[r.id])
    .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual')
    .map((a) => ({ id: a.id, title: a.title, items: (a.details?.items ?? []).slice(0, 4).map((i) => i.node?.selector ?? i.node?.snippet ?? '') })),
  failedOtherAudits: ['best-practices', 'seo'].flatMap((cat) => (st.lhr.categories[cat]?.auditRefs ?? [])
    .map((r) => st.lhr.audits[r.id])
    .filter((a) => a && a.score !== null && a.score < 1 && !['notApplicable', 'manual', 'informative'].includes(a.scoreDisplayMode))
    .map((a) => `${cat}: ${a.id}`)),
}));
writeFileSync(join(OUT, 'lighthouse-summary.json'), JSON.stringify(summary, null, 2) + '\n');
for (const st of summary) console.log(`${st.step.padEnd(55)} ${st.mode.padEnd(10)} ${JSON.stringify(st.scores)}`);
await browser.close();
