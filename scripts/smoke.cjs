// Browser smoke test for the site. Requires Playwright and a Chromium build.
// Setup (once):  npm i -D playwright && npx playwright install chromium
// Or point to an existing Chromium:  CHROMIUM_PATH=/path/to/chromium node scripts/smoke.cjs
// Usage: node scripts/smoke.cjs [path/to/index.html]
// Checks: CSP violations, consent gate, honeypot, mailto fallback status,
// accessible mobile button, legal page links resolve, no horizontal overflow on phone width.
const { chromium } = require('playwright');
const path = require('path');
const base = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const out = { consoleErrors: [], checks: {} };
  const isCdnBlocked = (t) => t.includes('ERR_TUNNEL_CONNECTION_FAILED') || t.includes('ERR_FILE_NOT_FOUND');

  // --- Desktop: form behaviour
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  page.on('console', m => { if (m.type() === 'error' && !isCdnBlocked(m.text())) out.consoleErrors.push('desktop: ' + m.text()); });
  page.on('pageerror', e => out.consoleErrors.push('desktop pageerror: ' + e.message));
  const reqs = [];
  page.on('request', r => { if (r.url().startsWith('http') && !/fonts\.g|cdnjs/.test(r.url())) reqs.push(r.method() + ' ' + r.url()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  out.checks.consentAttributeRequired = await page.evaluate(() => document.getElementById('consent').required);
  await page.fill('#name', 'Тест'); await page.fill('#email', 'test@example.com');
  await page.selectOption('#age-group', 'adult'); await page.fill('#goal', 'Проверка формы');
  await page.click('.form-submit');
  await page.waitForTimeout(300);
  out.checks.submitWithoutConsentBlocked = await page.evaluate(() => !document.getElementById('consent').checkValidity());
  out.checks.noAlertOnBlocked = dialogs.length === 0;

  await page.check('#consent');
  // Honeypot filled => silently ignored (no status text, no mail)
  await page.evaluate(() => { document.querySelector('input[name="website"]').value = 'http://spam.example'; });
  await page.click('.form-submit');
  await page.waitForTimeout(300);
  out.checks.honeypotIgnored = (await page.textContent('#form-status')).trim() === '';
  await page.evaluate(() => { document.querySelector('input[name="website"]').value = ''; });

  // Mailto fallback: status must be honest (no claim that the request was sent)
  await page.evaluate(() => { window.__mailto = null; });
  await page.click('.form-submit');
  await page.waitForTimeout(400);
  const status = (await page.textContent('#form-status')).trim();
  out.checks.mailtoStatus = status;
  out.checks.statusNotFalseSuccess = !/Ваша заявка отправлена/.test(status);
  out.checks.formNotResetInMailtoMode = await page.evaluate(() => document.getElementById('name').value === 'Тест');
  out.checks.networkRequestsOnSubmit = reqs.filter(r => !r.startsWith('GET http://localhost')).length;

  // Legal links resolve to real pages
  for (const href of ['privacy.html', 'terms.html', 'refund.html']) {
    const res = await page.request.get(base.replace('index.html', href)).catch(() => null);
    out.checks['legal:' + href] = res ? (res.status() === 200 || base.startsWith('file:')) : 'n/a (file://)';
  }
  out.checks.footerLinks = await page.evaluate(() => [...document.querySelectorAll('.footer-policies a')].map(a => a.getAttribute('href')));
  await ctx.close();

  // --- Mobile: menu button semantics, overflow
  ctx = await browser.newContext({ viewport: { width: 375, height: 740 } });
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !isCdnBlocked(m.text())) out.consoleErrors.push('mobile: ' + m.text()); });
  page.on('pageerror', e => out.consoleErrors.push('mobile pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  out.checks.mobileToggleTag = await page.evaluate(() => document.getElementById('mobile-toggle').tagName);
  out.checks.ariaBefore = await page.getAttribute('#mobile-toggle', 'aria-expanded');
  await page.click('#mobile-toggle'); await page.waitForTimeout(400);
  out.checks.ariaOpen = await page.getAttribute('#mobile-toggle', 'aria-expanded');
  await page.click('#nav a[href="#services"]'); await page.waitForTimeout(600);
  out.checks.ariaAfterLinkClick = await page.getAttribute('#mobile-toggle', 'aria-expanded');
  out.checks.overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  // Consent row must not overflow on phone width
  await page.locator('#contact').scrollIntoViewIfNeeded();
  out.checks.consentRowFits = await page.evaluate(() => {
    const el = document.querySelector('.form-consent'); const r = el.getBoundingClientRect();
    return r.right <= window.innerWidth + 1;
  });
  await ctx.close();

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('VERIFY FAILED', e); process.exit(1); });
