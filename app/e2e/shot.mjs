import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.BASE ?? 'http://localhost:3000';
const out = process.env.OUT ?? '/tmp/claude-1000/shots';
import fs from 'node:fs'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = {};
for (const [name, vp] of [['desktop', { width: 1366, height: 820 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-1-home.png` });
  await page.getByRole('button', { name: /Pokaż przykład|Try the example/i }).click();
  await page.waitForSelector('text=Najlepsza dla Ciebie', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-2-route.png` });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  results[name] = { errors, violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0]?.html?.slice(0, 160) })) };
  await ctx.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
