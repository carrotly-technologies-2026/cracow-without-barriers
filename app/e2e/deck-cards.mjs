import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = new URL('../../docs/shots/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000'); await p.waitForTimeout(2000);
await p.getByRole('button', { name: /Pokaż przykład/ }).click();
await p.waitForSelector('text=Najlepsza dla Ciebie', { timeout: 120000 }); await p.waitForTimeout(3000);
const card = async (title, file, open = false) => {
  const li = p.locator('ol > li', { hasText: title }).first();
  if (!(await li.count())) { console.log('missing', title); return; }
  await li.scrollIntoViewIfNeeded();
  if (open) { const det = li.locator('details').first(); if ((await det.count()) && !(await det.evaluate((e) => e.open))) await det.locator('summary').click(); }
  await p.waitForTimeout(400);
  await li.screenshot({ path: out + file });
};
await p.getByRole('radio', { name: /Najkrótsza/ }).click(); await p.waitForTimeout(1500);
await card('Schody (13 stopni)', 'c-steps.png', true);
await card('Sprzeczne dane o krawężniku', 'c-conflict.png', true);
await card('przejść bez danych', 'c-unknown.png');
await p.getByRole('radio', { name: /Alternatywa/ }).click(); await p.waitForTimeout(1500);
await card('Zgłoszono: przejście zablokowane', 'c-report.png', true);
await card('Nierówna nawierzchnia: kostka brukowa', 'c-cobble.png', true);
// summary tiles + route cards
await p.getByRole('radio', { name: /Najlepsza/ }).click(); await p.waitForTimeout(1000);
await p.locator('[role=radiogroup]').first().screenshot({ path: out + 'c-routes.png' });
await b.close(); console.log('ok');
