// Build the PDF report from the web version, so the two always carry the same text and numbers.
//
//   node scripts/07_build_report.js
//
// Needs Node 18+ and Playwright with Chromium (`npm install playwright`, `npx playwright install chromium`).
// Serves docs/ locally, loads index.html, waits for the page to compute its numbers, then rebuilds the
// article as a printed document: title page, sections 1-7 and references; the interactive map is replaced
// by the static map figure (figures/fig4_maps.png), controls are removed, and the page is set for A4 with
// docs/report/report.css. Writes docs/report/oueme-ogun-water-balance.pdf.

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'report', 'oueme-ogun-water-balance.pdf');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.geojson': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv' };

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const url = decodeURIComponent(req.url.split('?')[0]);
            // figures/ lives outside docs/; it is served under /figures/ for the static map figure
            const file = url.startsWith('/figures/') ? path.join(ROOT, url) : path.join(DOCS, url === '/' ? 'index.html' : url);
            if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

(async () => {
    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    // Errors while the web page loads are real; after the article is rebuilt for print, the page's own
    // resize and scroll handlers can no longer find the maps and controls removed, which does not matter.
    const errors = [];
    let rebuilt = false;
    page.on('pageerror', e => { if (!rebuilt) errors.push(e.message); });
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#table-2 tbody tr') && document.querySelector('#ratiochart svg'));
    await page.waitForTimeout(500);

    rebuilt = true;
    await page.evaluate(() => {
        const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
        const main = $('main');
        // keep the article: title, abstract, sections 1-7, references
        $$('.bar, .skip, footer, #explorer, .note, #data-code').forEach(e => e.remove());
        $$('main > .wide').filter(e => e.querySelector('#explore-map')).forEach(e => e.remove());
        // Figure 4: the scroll-driven map becomes the static map figure
        const f4 = $('#fig-map'), cap = f4.querySelector('figcaption');
        f4.innerHTML = '<img src="/figures/fig4_maps.png" alt="Maps of WaPOR v3 evapotranspiration and of CHIRPS v2.0 rainfall minus evapotranspiration, 2018-2024 mean, for both catchments">';
        cap.innerHTML = '<b>Figure 4.</b> WaPOR v3 evapotranspiration (top) and CHIRPS v2.0 rainfall minus evapotranspiration (bottom), 2018–2024 mean, mm per year, on the 5 km CHIRPS grid. The web version shows these maps year by year.';
        f4.append(cap); f4.style.marginTop = '';
        // Figures 6 and 8: drop the controls, keep the drawing at the values reported in the text
        $$('#fig-storage .control, #fig-closing .control, #fig-closing .buttons').forEach(e => e.remove());
        $('#fig-storage figcaption').insertAdjacentHTML('beforeend', ' Drawn for a specific yield of 1.5% and CHIRPS v2.0; the web version lets both be changed.');
        $('#fig-closing figcaption').innerHTML = '<b>Figure 8.</b> Upper Ouémé water balance, 2018–2024 mean, CHIRPS v2.0, with the runoff ratio of Table 2. The web version lets each term be changed.';
        $$('#fig-closing .interactive > div:first-child').forEach(e => e.remove());
        // title page and colophon
        const header = $('header.title');
        header.insertAdjacentHTML('beforeend', '<p class="report-note">Report version of the web publication at oloyededavid.github.io/Oueme-Ogun-Groundwater-Recharge. Code, data and tests: github.com/oloyededavid/Oueme-Ogun-Groundwater-Recharge.</p>');
        $('#references').insertAdjacentHTML('beforebegin',
            '<section id="availability"><h2>Data and code availability</h2><p>All scripts, the analysis outputs, a dataset inventory (research/data_inventory.csv) and a register of assumptions (research/assumptions.md) are in the repository github.com/oloyededavid/Oueme-Ogun-Groundwater-Recharge. Every number in this report is computed from outputs/summary.json and outputs/annual_balance.csv, which scripts 01–03 produce from openly available data. The Bétérou flows are taken from Kodja et al. (2020); the underlying daily records are not public.</p></section>');
        document.body.classList.add('report');
        main.classList.remove('article');
    });
    await page.addStyleTag({ path: path.join(DOCS, 'report', 'report.css') });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));

    const date = new Date().toISOString().slice(0, 10);
    await page.pdf({
        path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;font:8px Helvetica,Arial,sans-serif;color:#6b6b6b;padding:0 18mm;display:flex;justify-content:space-between"><span>Oloyede · Testing a satellite water balance for groundwater recharge · v0.3</span><span class="pageNumber"></span></div>`,
        margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' }
    });
    await browser.close(); server.close();
    if (errors.length) { console.error('page errors:', errors); process.exit(1); }
    console.log(`report written: ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, built ${date})`);
})();
