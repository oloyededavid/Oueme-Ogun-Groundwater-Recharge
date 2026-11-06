// Behaviour checks for the research-paper page. Expected values come from outputs/summary.json.
const { chromium } = require('playwright');
const fs = require('fs');
const SUM = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../outputs/summary.json'), 'utf8'));
const C = SUM.closure_upper_oueme_2018_2024, URL = process.env.URL || 'http://127.0.0.1:8767/index.html';
const n = s => Number(String(s).replace(/,/g, '').replace('−', '-'));
(async () => {
  const b = await chromium.launch(), fails = [], errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new (require('url').URL)(URL).origin });
  const p = await ctx.newPage();
  await p.route(/arcgisonline/, r => r.abort());
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const t = s => p.$eval(s, e => e.textContent.trim());
  const ok = (name, cond) => { if (!cond) fails.push(name); console.log(cond ? 'PASS' : 'FAIL', name); };
  const gaps = ['chirps2', 'chirps3', 'tamsat'].map(k => Math.round(C[k].mean_closure_residual_mm));
  ok(`abstract residual range ${Math.min(...gaps)}–${Math.max(...gaps)}`, (await t('#abstract [data-v="gapRange"]')) === `${Math.min(...gaps)}–${Math.max(...gaps)}`);
  ok('no placeholder dashes left in filled values', (await p.$$eval('[data-v]', es => es.filter(e => e.textContent.trim() === '—').length)) === 0);
  const t2 = await p.$$eval('#table-2 tbody tr', rs => rs.map(r => r.cells[5].textContent));
  ok(`Table 2 residuals ${gaps.join(', ')}`, t2.map(n).join() === gaps.join());
  // Figure 3
  const rise = (k, sy) => Math.round(C[k].cumulative_residual_mm / (sy * 10));
  ok(`Fig 3 rise at 1.5% = ${rise('chirps2', 1.5)} m`, n(await t('#rise-out')) === rise('chirps2', 1.5));
  await p.$eval('#sy', e => { e.value = '0.2'; e.dispatchEvent(new Event('input')); });
  ok(`Fig 3 rise at 0.2% = ${rise('chirps2', 0.2)} m`, n(await t('#rise-out')) === rise('chirps2', 0.2));
  await p.click('#fig-storage [data-prod="chirps3"]'); await p.waitForTimeout(150);
  ok(`product switch: rise ${rise('chirps3', 0.2)} m`, n(await t('#rise-out')) === rise('chirps3', 0.2));
  ok('product switch: both selectors pressed', (await p.$$eval('[data-prod="chirps3"]', bs => bs.every(x => x.getAttribute('aria-pressed') === 'true'))));
  ok('product switch: text names CHIRPS v3.0', (await t('#h-storage ~ p [data-v="selName"], [data-v="selName"]')) === 'CHIRPS v3.0');
  ok('product switch: Figure 5 reset to v3 residual', n(await t('#fx-gap')) === gaps[1]);
  await p.focus('#fig-closing [data-prod="tamsat"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  ok('keyboard focus stays on the product button', await p.evaluate(() => document.activeElement.matches('#fig-closing [data-prod="tamsat"]')));
  ok('TAMSAT residual shown', n(await t('#fx-gap')) === gaps[2]);
  // Figure 5
  for (const pr of ['et', 'rain', 'ratio']) {
    await p.click(`[data-preset="${pr}"]`); await p.waitForTimeout(80);
    const g = n(await t('#fx-gap'));
    ok(`preset ${pr} closes the balance (got ${g})`, Math.abs(g) <= 5 && (await p.$eval('#fx-status', e => e.classList.contains('ok'))));
  }
  await p.click('[data-preset="reset"]'); ok('reset restores residual', n(await t('#fx-gap')) === gaps[2]);
  await p.$eval('#fx-et', e => { e.value = '30'; e.dispatchEvent(new Event('input')); });
  ok('negative residual uses a minus sign', (await t('#fx-gap')).startsWith('−'));
  await p.click('[data-preset="reset"]');
  // Explorer
  await p.click('#ex-zone [data-zone="upper_ogun"]'); await p.click('#ex-layer [data-layer="et"]'); await p.click('#ex-year [data-year="2020"]'); await p.waitForTimeout(500);
  ok('explorer side shows only Upper Ogun', (await p.$$eval('#ex-side .basin h3', hs => hs.map(h => h.textContent).join())) === 'Upper Ogun');
  ok('explorer table has 8 rows', (await p.$$eval('#ex-table tbody tr', r => r.length)) === 8);
  ok('rainfall buttons disabled for ET', await p.$eval('#ex-prod button', e => e.disabled));
  ok('query string written', (await p.evaluate(() => location.search)) === '?zone=upper_ogun&layer=et&year=2020&product=tamsat');
  await p.focus('#ex-table tr[data-year="2021"] .yr'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok('table year button keeps focus after re-render', await p.evaluate(() => document.activeElement.matches('#ex-table tr[data-year="2021"] .yr') && document.activeElement.getAttribute('aria-pressed') === 'true'));
  ok('year selector follows the table', (await p.$eval('#ex-year [data-year="2021"]', e => e.getAttribute('aria-pressed'))) === 'true');
  await p.click('#ex-layer [data-layer="rain"]'); await p.click('#ex-prod [data-xprod="tamsat"]'); await p.waitForTimeout(200);
  ok('legend follows product', (await t('#el-source')) === 'TAMSAT v3.1');
  await p.click('#ex-year [data-year="mean"]'); await p.click('#ex-play'); await p.waitForTimeout(2300);
  const yr = await p.$eval('#ex-year [aria-pressed="true"]', e => e.dataset.year);
  ok(`play advances the year (at ${yr})`, ['2019', '2020', '2021'].includes(yr));
  await p.click('#ex-play'); const held = await p.$eval('#ex-year [aria-pressed="true"]', e => e.dataset.year); await p.waitForTimeout(1500);
  ok(`pause holds the year (${held})`, (await p.$eval('#ex-year [aria-pressed="true"]', e => e.dataset.year)) === held && (await p.$eval('#ex-play', e => e.getAttribute('aria-label'))) === 'Play through the years');
  // citation, navigation, story
  await p.click('#copy-cite'); await p.waitForTimeout(250);
  ok('citation copied', (await p.evaluate(() => navigator.clipboard.readText())).startsWith('Oloyede, D. O. (2026).') && !!(await p.$('.snack')));
  await p.evaluate(() => document.getElementById('discussion').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
  ok('contents bar marks Discussion', (await p.$eval('.toc a[aria-current="true"]', a => a.textContent)) === 'Discussion');
  await p.evaluate(() => document.querySelector('#fig-1').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  ok('contents bar marks Study area at Figure 1', (await p.$eval('.toc a[aria-current="true"]', a => a.textContent)) === 'Study area');
  for (const [s, title] of [['et', 'Evapotranspiration'], ['gap', 'Rainfall minus evapotranspiration'], ['rain', 'Rainfall,']]) {
    await p.evaluate(s => { const el = document.querySelector(`.step[data-step="${s}"]`); scrollTo(0, el.getBoundingClientRect().top + scrollY - (innerHeight - el.offsetHeight) / 2); }, s); await p.waitForTimeout(900);
    ok(`story step ${s} sets the map`, (await t('#sl-title')).startsWith(title) && (await p.$eval(`.step[data-step="${s}"]`, e => e.classList.contains('is-active'))));
  }
  ok('no table scroll stop on desktop', (await p.$$eval('.table-wrap[tabindex]', w => w.length)) === 0);
  // restoring a shared link
  await p.goto(`${URL}?zone=upper_oueme&layer=rain&year=2023&rain=chirps3&product=chirps3`, { waitUntil: 'load' }); await p.waitForTimeout(2000);
  ok('link restores explorer year', (await p.$eval('#ex-year [aria-pressed="true"]', e => e.dataset.year)) === '2023');
  ok('link restores explorer product', (await p.$eval('#ex-prod [aria-pressed="true"]', e => e.dataset.xprod)) === 'chirps3');
  ok('link restores figure product', (await p.$eval('#fig-storage [aria-pressed="true"]', e => e.dataset.prod)) === 'chirps3');
  // phone
  const m = await b.newPage({ viewport: { width: 390, height: 844 } }); await m.route(/arcgisonline/, r => r.abort());
  m.on('pageerror', e => errs.push('phone: ' + e.message));
  await m.goto(URL, { waitUntil: 'load' }); await m.waitForTimeout(2200);
  ok('phone: wide tables become labelled scroll regions', await m.$eval('#cap-t1', c => { const w = c.parentElement.querySelector('.table-wrap'); return w.tabIndex === 0 && w.getAttribute('role') === 'region' && w.getAttribute('aria-labelledby') === 'cap-t1'; }));
  ok('phone: locator uses large labels', await m.$eval('#locator', e => e.classList.contains('is-small')));
  ok('phone: no sideways scroll', await m.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await m.evaluate(() => { const el = document.querySelector('.step[data-step="et"]'); scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.6); }); await m.waitForTimeout(900);
  ok('phone: step starts while its card is in the lower half', (await m.$eval('#sl-title', e => e.textContent)).startsWith('Evapotranspiration'));
  console.log('FAILS', fails.length, JSON.stringify(fails), 'ERRORS', JSON.stringify(errs)); await b.close();
})();
