// Audit a page: console errors, failed requests, axe accessibility, overflow, interactive checks.
const { chromium } = require('playwright');
const AXE = process.env.AXE, URL = process.env.URL || 'http://127.0.0.1:8767/index.html';
(async () => {
  const b = await chromium.launch(); const out = { errors: [], http: [], axe: {}, overflow: {} };
  for (const [name, vp, scheme] of [['desktop', { width: 1440, height: 900 }, 'light'], ['desktop-dark', { width: 1440, height: 900 }, 'dark'], ['phone', { width: 390, height: 844 }, 'light']]) {
    const p = await b.newPage({ viewport: vp, colorScheme: scheme });
    await p.route(/arcgisonline/, r => r.abort());
    p.on('pageerror', e => out.errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) out.errors.push(`${name}: ${m.text()}`); });
    p.on('response', r => { if (r.status() >= 400) out.http.push(`${r.status()} ${r.url()}`); });
    await p.goto(URL, { waitUntil: "load" }); await p.waitForTimeout(3200);
    out.overflow[name] = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await p.addScriptTag({ path: AXE });
    const res = await p.evaluate(async () => { const r = await axe.run(document, { resultTypes: ['violations'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, eg: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) })); });
    out.axe[name] = res;
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
