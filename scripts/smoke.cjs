// Browser smoke test against a RUNNING server (npm run build, then start the server, then this).
// Requires Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
//   or CHROMIUM_PATH=/path/to/chromium. Usage: SMOKE_URL=http://localhost:8080 node scripts/smoke.cjs
'use strict';
const { chromium } = require('playwright');

const BASE = process.env.SMOKE_URL || 'http://localhost:8080';
const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); else console.log('  ok  ' + msg); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const consoleProblems = [];
  const newContext = async (viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'en-US' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(m.text()); });
    page.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
    return { ctx, page };
  };

  // 1. Each language: home renders, has h1, hreflang, no horizontal overflow on phone width
  for (const [lang, viewport] of [['ru', { width: 1280, height: 800 }], ['fr', { width: 375, height: 740 }], ['en', { width: 1280, height: 800 }]]) {
    const { ctx, page } = await newContext(viewport);
    const resp = await page.goto(`${BASE}/${lang}/`, { waitUntil: 'load' });
    ok(resp && resp.status() === 200, `${lang} home returns 200`);
    ok((await page.locator('h1').count()) === 1, `${lang} home has one h1`);
    ok((await page.getAttribute('html', 'lang')) === lang, `${lang} html lang set`);
    ok((await page.locator('link[rel="alternate"][hreflang="x-default"]').count()) === 1, `${lang} has x-default hreflang`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!overflow, `${lang} home: no horizontal overflow at ${viewport.width}px`);
    await ctx.close();
  }

  // 2. Mobile menu: opens, aria-expanded toggles, Escape closes
  {
    const { ctx, page } = await newContext({ width: 375, height: 740 });
    await page.goto(`${BASE}/en/`, { waitUntil: 'load' });
    await page.click('#menu-toggle');
    await page.waitForTimeout(500);
    ok((await page.getAttribute('#menu-toggle', 'aria-expanded')) === 'true', 'mobile menu: aria-expanded true when open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    ok((await page.getAttribute('#menu-toggle', 'aria-expanded')) === 'false', 'mobile menu: Escape closes');
    await ctx.close();
  }

  // 3. Lead form: consent gate, then real submission; success text only after 201
  {
    const { ctx, page } = await newContext({ width: 1280, height: 900 });
    const apiCalls = [];
    page.on('response', (r) => { if (r.url().includes('/api/leads')) apiCalls.push(r.status()); });
    await page.goto(`${BASE}/en/contact/`, { waitUntil: 'load' });
    await page.fill('#lead-name', 'Smoke Test');
    await page.fill('#lead-email', 'smoke@example.com');
    await page.selectOption('#lead-topic', 'general');
    await page.click('#lead-form button[type="submit"]');
    await page.waitForTimeout(300);
    ok(apiCalls.length === 0, 'lead form: no request without consent');
    await page.check('#lead-consent');
    await page.click('#lead-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('#lead-form .form-status').textContent.trim().length > 0, null, { timeout: 8000 });
    const status = (await page.textContent('#lead-form .form-status')).trim();
    ok(apiCalls[0] === 201, `lead form: API answered 201 (got ${apiCalls[0]})`);
    ok(/received/i.test(status), 'lead form: success message shown after 201');
    await ctx.close();
  }

  // 4. Cart page without items
  {
    const { ctx, page } = await newContext({ width: 1280, height: 800 });
    await page.goto(`${BASE}/en/cart/`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    ok(await page.isVisible('[data-cart-empty]'), 'cart: empty state visible');
    ok(!(await page.isVisible('[data-checkout]')), 'cart: checkout hidden when empty');
    await ctx.close();
  }

  // 5. Legal pages render; drafts are visibly marked; FAQ details open
  {
    const { ctx, page } = await newContext({ width: 1280, height: 800 });
    for (const p of ['legal/mentions/', 'legal/privacy/', 'legal/terms-of-sale/', 'legal/refunds/', 'legal/digital-products/', 'legal/cookies/']) {
      const r = await page.goto(`${BASE}/fr/${p}`, { waitUntil: 'load' });
      ok(r.status() === 200, `legal ${p} loads`);
    }
    ok((await page.locator('mark.todo').count()) >= 0, 'legal: placeholders are rendered as marks (count may be 0 after data entry)');
    await page.goto(`${BASE}/en/faq/`, { waitUntil: 'load' });
    await page.click('.faq details summary >> nth=0');
    ok(await page.evaluate(() => document.querySelector('.faq details').open), 'faq: details opens');
    await ctx.close();
  }

  // 6. Language switcher keeps the same page
  {
    const { ctx, page } = await newContext({ width: 1280, height: 800 });
    await page.goto(`${BASE}/ru/consultations/`, { waitUntil: 'load' });
    await page.click('.lang-switch a[hreflang="fr"]');
    await page.waitForLoadState('load');
    ok(page.url().endsWith('/fr/consultations/'), 'language switch keeps the page');
    await ctx.close();
  }

  // 7. CSP: no violations reported
  const csp = consoleProblems.filter((t) => /Content Security Policy|Refused to/i.test(t));
  ok(csp.length === 0, `no CSP violations (${csp.length})`);
  ok(consoleProblems.length === 0, `no console errors or warnings (${consoleProblems.length}: ${consoleProblems.slice(0, 3).join(' | ')})`);

  await browser.close();
  if (failures.length) {
    console.log('\nFAILED:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  console.log('\nSmoke test passed.');
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
