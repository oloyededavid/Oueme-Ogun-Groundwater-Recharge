// Checks for the reader features: catchment selection, equation, datasets drawer, figure viewer and links,
// feedback (FormSubmit, mocked; mailto fallback), reading progress and back to top. Set URL to the page to test.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(), fails = [], errs = [];
  const ok = (n, c) => { if (!c) fails.push(n); console.log(c ? 'PASS' : 'FAIL', n); };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new (require('url').URL)(process.env.URL).origin });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.env.URL, { waitUntil: 'load' }); await p.waitForTimeout(3000);
  const t = s => p.$eval(s, e => e.textContent.trim());
  // C + A: map selection and Figure 2 follow each other
  await p.click('#locator [data-basin="upper_ogun"]'); await p.waitForTimeout(300);
  ok('map selects Upper Ogun', (await t('#basin-info h3')) === 'Upper Ogun' && (await p.$eval('#basin-seg [data-basin="upper_ogun"]', e => e.getAttribute('aria-pressed'))) === 'true');
  ok('Ogun panel: 9,534 km², no flow record', (await t('#basin-info')).includes('9,534 km²') && (await t('#basin-info')).includes('None found'));
  ok('Figure 2 stats switch to Ogun', (await t('#basin-stats')).includes('no record') && (await t('#basin-stats')).includes('1,296–1,492'));
  await p.focus('#locator [data-basin="upper_oueme"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('keyboard selects Upper Ouémé on the map', (await t('#basin-info h3')) === 'Upper Ouémé');
  await p.click('#basin-seg [data-basin="upper_ogun"]'); await p.waitForTimeout(600);
  ok('switch in Figure 2 updates the map', await p.$eval('#locator [data-basin="upper_ogun"]', e => e.classList.contains('is-on')));
  // B: equation
  await p.click('.term[data-term="Q"]');
  ok('equation shows Q and the residual note', (await t('#eqx')).startsWith('River flow, Q') && (await t('#eqx')).includes('not a measure of recharge'));
  ok('equation sum matches Table 2 for CHIRPS v2.0', (await t('#eqx')).includes('= 134 mm'));
  // F: datasets drawer
  await p.click('#open-datasets'); ok('datasets drawer opens', await p.$eval('#datasets', d => d.open));
  ok('six datasets listed', (await p.$$eval('#datasets .ds > div', x => x.length)) === 6);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('drawer closes with Escape and returns focus', !(await p.$eval('#datasets', d => d.open)) && await p.evaluate(() => document.activeElement.id === 'open-datasets'));
  // D: enlarge
  await p.click('#fig-ratio .tool[data-act="enlarge"]'); await p.waitForTimeout(200);
  ok('figure viewer opens with title and source', (await p.$eval('#fig-viewer', d => d.open)) && (await t('#viewer-title')) === 'Figure 4' && (await t('#viewer-src')).startsWith('Source:') && !!(await p.$('#viewer-body svg')));
  await p.click('#fig-viewer [data-close]'); ok('viewer closes', !(await p.$eval('#fig-viewer', d => d.open)));
  // figure link
  await p.click('#fig-rain .tool[data-act="link"]'); await p.waitForTimeout(200);
  ok('figure link copied', (await p.evaluate(() => navigator.clipboard.readText())).endsWith('#fig-rain'));
  // feedback: sent by email through FormSubmit (mocked here), mailto fallback when it fails
  let posted = null;
  await p.route(/formsubmit\.co/, r => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' }); });
  await p.click('.react[data-react="Useful"]'); await p.fill('#fb-text', 'Test note');
  await p.click('#fb-form button[type="submit"]'); await p.waitForTimeout(500);
  ok('feedback posts reaction and note', !!posted && posted.reaction === 'Useful' && posted.message === 'Test note');
  ok('feedback confirms it was sent', (await t('#fb-status')).startsWith('Sent.'));
  await p.unroute(/formsubmit\.co/);
  await p.route(/formsubmit\.co/, r => r.fulfill({ status: 522, body: '' }));
  await p.fill('#fb-text', 'Second note'); await p.click('#fb-form button[type="submit"]'); await p.waitForTimeout(600);
  ok('feedback falls back to email app', (await t('#fb-status')).includes('email app'));
  ok('reaction is pressed', (await p.$eval('.react[data-react="Useful"]', e => e.getAttribute('aria-pressed'))) === 'true');
  // header, progress, back to top
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight / 2)); await p.waitForTimeout(400);
  ok('progress bar moves', (await p.$eval('#progress', e => parseFloat(e.style.width))) > 20);
  ok('back-to-top shows', !(await p.$eval('#to-top', e => e.hidden)));
  await p.click('#to-top'); await p.waitForTimeout(2500); ok('back to top scrolls up', (await p.evaluate(() => scrollY)) < 50);
  ok('header nav present with 6 links', (await p.$$eval('.toc a', a => a.length)) === 6);
  console.log('FAILS', fails.length, JSON.stringify(fails), 'ERRORS', JSON.stringify(errs)); await b.close(); })();
