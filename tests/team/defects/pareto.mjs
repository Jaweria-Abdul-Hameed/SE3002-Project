// Pareto analysis of our defects by category, read live from the GitHub issues (labels category:*,
// severity:*, type:*). Writes docs/evidence/defects/pareto.svg and docs/evidence/defects/defects.json.
// Usage (from the repository root, gh signed in): node tests/team/defects/pareto.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const REPO = 'Jaweria-Abdul-Hameed/SE3002-Project';
const issues = JSON.parse(execFileSync('gh', ['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '200',
  '--json', 'number,title,state,labels'], { encoding: 'utf8' }))
  .filter((i) => i.labels.some((l) => l.name.startsWith('type:')));
const label = (i, prefix) => (i.labels.find((l) => l.name.startsWith(prefix))?.name ?? `${prefix}none`).slice(prefix.length);

const counts = {};
for (const i of issues) counts[label(i, 'category:')] = (counts[label(i, 'category:')] ?? 0) + 1;
const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const total = issues.length;
let cum = 0;
const table = rows.map(([cat, n]) => { cum += n; return { category: cat, count: n, percent: +(100 * n / total).toFixed(1), cumulative: +(100 * cum / total).toFixed(1) }; });

// SVG: bars = count per category (left axis), line = cumulative % (right axis), dashed 80 % line.
const W = 640, H = 360, L = 60, R = 60, T = 40, B = 90;
const pw = W - L - R, ph = H - T - B, bw = pw / table.length, maxN = Math.max(...table.map((r) => r.count));
const y = (n) => T + ph - (ph * n) / maxN;
const yp = (p) => T + ph - (ph * p) / 100;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial" font-size="12">`;
svg += `<rect width="${W}" height="${H}" fill="white"/><text x="${W / 2}" y="22" text-anchor="middle" font-size="15" font-weight="bold">Defects by category (Pareto), n = ${total}</text>`;
svg += `<line x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}" stroke="#333"/><line x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}" stroke="#333"/><line x1="${L + pw}" y1="${T}" x2="${L + pw}" y2="${T + ph}" stroke="#333"/>`;
for (let n = 0; n <= maxN; n++) svg += `<text x="${L - 8}" y="${y(n) + 4}" text-anchor="end">${n}</text>`;
for (const p of [0, 20, 40, 60, 80, 100]) svg += `<text x="${L + pw + 8}" y="${yp(p) + 4}">${p}%</text>`;
svg += `<line x1="${L}" y1="${yp(80)}" x2="${L + pw}" y2="${yp(80)}" stroke="#999" stroke-dasharray="4 4"/>`;
svg += `<text x="${18}" y="${T + ph / 2}" transform="rotate(-90 18 ${T + ph / 2})" text-anchor="middle">Number of defects</text>`;
svg += `<text x="${W - 14}" y="${T + ph / 2}" transform="rotate(90 ${W - 14} ${T + ph / 2})" text-anchor="middle">Cumulative %</text>`;
const pts = [];
table.forEach((r, k) => {
  const x = L + k * bw + bw * 0.15, cx = L + k * bw + bw / 2;
  svg += `<rect x="${x}" y="${y(r.count)}" width="${bw * 0.7}" height="${T + ph - y(r.count)}" fill="#4a78b5"/>`;
  svg += `<text x="${cx}" y="${y(r.count) - 6}" text-anchor="middle">${r.count}</text>`;
  svg += `<text x="${cx}" y="${T + ph + 18}" text-anchor="middle">${r.category}</text>`;
  pts.push(`${cx},${yp(r.cumulative)}`);
  svg += `<circle cx="${cx}" cy="${yp(r.cumulative)}" r="4" fill="#d9534f"/><text x="${cx + 8}" y="${yp(r.cumulative) - 6}" fill="#d9534f">${r.cumulative}%</text>`;
});
svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#d9534f" stroke-width="2"/></svg>\n`;

mkdirSync('docs/evidence/defects', { recursive: true });
writeFileSync('docs/evidence/defects/pareto.svg', svg);
writeFileSync('docs/evidence/defects/defects.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  total,
  open: issues.filter((i) => i.state === 'OPEN').length,
  byCategory: table,
  issues: issues.map((i) => ({ number: i.number, title: i.title, state: i.state, severity: label(i, 'severity:'), priority: label(i, 'priority:'), triage: label(i, 'triage:'), category: label(i, 'category:') })),
}, null, 2) + '\n');
console.table(table);
