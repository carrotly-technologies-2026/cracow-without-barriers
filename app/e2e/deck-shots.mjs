// Screenshots for the pitch deck (docs/shots). Needs the app on :3000.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = new URL('../../docs/shots/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const demo = (p) => p.getByRole('button', { name: /Pokaż przykład/ }).click();

// ---------- desktop ----------
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + 'd-home.png' });
  await demo(p);
  await p.waitForSelector('text=Najlepsza dla Ciebie', { timeout: 120000 }); await p.waitForTimeout(4000);
  await p.screenshot({ path: out + 'd-route.png' });
  // scroll the panel to the timeline & open the conflict
  const panel = p.locator('[role=tabpanel]');
  await p.getByRole('heading', { name: /Trasa krok po kroku/ }).scrollIntoViewIfNeeded();
  await panel.evaluate((el) => { el.scrollTop += 120; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + 'd-timeline.png' });
  const conflict = p.getByText('Sprzeczne dane o krawężniku').first();
  if (await conflict.count()) { await conflict.scrollIntoViewIfNeeded(); await conflict.click(); await p.waitForTimeout(1500); await p.screenshot({ path: out + 'd-conflict.png' }); }
  // place card
  await p.reload(); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: /Hotel Demo/ }).click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + 'd-place.png' });
  await p.getByRole('tab', { name: /Mapa/ }).click(); await p.waitForTimeout(4000);
  await p.screenshot({ path: out + 'd-explore.png' });
  await p.getByRole('tab', { name: /Dane i zaufanie/ }).click(); await p.waitForTimeout(800);
  await p.screenshot({ path: out + 'd-about.png' });
  await ctx.close();
}
// ---------- mobile ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + 'm-home.png' });
  await demo(p);
  await p.waitForSelector('text=Najlepsza dla Ciebie', { timeout: 120000 }); await p.waitForTimeout(4000);
  await p.screenshot({ path: out + 'm-route.png' });
  await p.getByRole('heading', { name: /Trasa krok po kroku/ }).scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  await p.screenshot({ path: out + 'm-timeline.png' });
  await p.reload(); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: /Hotel Demo/ }).click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + 'm-place.png' });
  await ctx.close();
}
await b.close();
console.log('ok');
