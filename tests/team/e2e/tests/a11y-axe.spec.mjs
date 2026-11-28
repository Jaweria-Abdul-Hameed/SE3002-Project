// Section 3: full axe-core scan (@axe-core/playwright, every rule, no tag filter) of each use case's key screen.
// Writes one JSON file per screen plus a summary to $A11Y_OUT (default docs/evidence/a11y/latest).
// This records findings; it does not fail on them (the findings and the fixed screen are in the Section 3 report).
// Owner: Muhammad Aun.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resetEnvironment, login, details, createPending } from './lib.mjs';
import { SCREENS } from '../a11y/screens.mjs';

const OUT = resolve(process.env.A11Y_OUT ?? '../../../docs/evidence/a11y/latest');
const summary = [];
let pending;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  resetEnvironment();
  pending = await createPending('requester1', 'A11Y Leaking tap in Room 101');
  mkdirSync(OUT, { recursive: true });
});
test.afterAll(() => writeFileSync(join(OUT, 'axe-summary.json'), JSON.stringify(summary, null, 2) + '\n'));

for (const s of SCREENS) {
  test(`axe ${s.id} ${s.useCase}: ${s.label}`, async ({ page }) => {
    await login(page, s.user);
    await page.goto(s.url.replace('{pending}', pending.id));
    if (s.url.includes('{pending}')) await expect(details(page)).toBeVisible();
    else await expect(page.getByRole('table')).toBeVisible();
    if (s.open?.button) {
      await (s.url.includes('{pending}') ? details(page) : page).getByRole('button', { name: s.open.button, exact: true }).click();
      await expect(page.getByRole('dialog').last()).toBeVisible();
    }
    if (s.open?.editIcon) {
      await details(page).locator('button:has(svg[data-testid="EditTwoToneIcon"])').click();
      await expect(page.getByRole('dialog').last()).toBeVisible();
    }
    await page.waitForTimeout(800);
    const result = await new AxeBuilder({ page }).analyze();
    writeFileSync(join(OUT, `axe-${s.id}.json`), JSON.stringify(result, null, 2) + '\n');
    const violations = result.violations.map((v) => ({
      rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
    }));
    summary.push({ screen: s.id, useCase: s.useCase, label: s.label, violations });
    test.info().annotations.push({ type: 'violations', description: violations.map((v) => `${v.rule}(${v.impact}) x${v.nodes}`).join(', ') || 'none' });
  });
}
