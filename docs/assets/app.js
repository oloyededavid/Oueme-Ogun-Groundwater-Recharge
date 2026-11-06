/* Page logic for the Ouémé–Ogun water-balance study.
   Every number is computed here from data/app_data.json (written by scripts/06_build_app.py from the
   analysis outputs); none is typed into the HTML. */
(function () {
    'use strict';

    // ---------- helpers ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const isNum = v => v !== null && v !== undefined && Number.isFinite(Number(v));
    // Negative numbers take a true minus sign (U+2212), and a value that rounds to zero is shown as 0, not −0.
    const num = (v, d) => {
        if (!isNum(v)) return '—';
        const r = Math.round(Number(v) * 10 ** d) / 10 ** d;
        return (r === 0 ? 0 : r).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');
    };
    const fmtInt = v => num(v, 0);
    const fmt = (v, d = 1) => num(v, d);
    const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
    // a range with a negative end reads better with "to" than with a dash ("−50 to 171", not "−50–171")
    const range = (vals, f = fmtInt) => { const v = vals.filter(isNum); const a = f(Math.min(...v)), b = f(Math.max(...v)); return a === b ? a : Math.min(...v) < 0 ? `${a} to ${b}` : `${a}–${b}`; };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const svg = (tag, attrs = {}, text) => {
        const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text !== undefined) e.textContent = text;
        return e;
    };

    const YEARS = ['2018', '2019', '2020', '2021', '2022', '2023', '2024'];
    const PRODS = ['chirps2', 'chirps3', 'tamsat'];
    const PROD = { chirps2: 'CHIRPS v2.0', chirps3: 'CHIRPS v3.0', tamsat: 'TAMSAT v3.1' };
    const pcol = k => css(`--p-${k}`);
    const BIDS = ['upper_oueme', 'upper_ogun'];
    const BASIN = { upper_oueme: 'Upper Ouémé', upper_ogun: 'Upper Ogun' };

    const S = { product: 'chirps2', sy: 1.5, fx: { et: 0, rain: 0, ratio: null }, ex: { zone: 'ALL', layer: 'surplus', period: 'mean', product: 'chirps2' } };
    let D = null, GEO = null, CTX = null;

    // ---------- data access ----------
    const rowsOf = b => D.annual.filter(r => r.basin_id === b);
    function rec(b, key = 'mean') {
        const rs = rowsOf(b);
        if (key !== 'mean') return rs.find(r => String(r.year) === String(key));
        const o = {};
        Object.keys(rs[0]).forEach(k => { if (typeof rs[0][k] === 'number') o[k] = rs.reduce((a, r) => a + r[k], 0) / rs.length; });
        return o;
    }
    const clo = () => D.summary.closure_upper_oueme_2018_2024;
    const props = b => GEO.features.find(f => f.properties.basin_id === b).properties;
    const ratioObs = () => D.summary.beterou_observed_runoff.ratio_range[1];

    function values() {
        const o = rec('upper_oueme'), g = rec('upper_ogun'), c = clo(), q = D.summary.qa, k = S.product, ck = c[k];
        const B = D.summary.basins, own = D.summary.closure_check_own_product_ratio || {}, per = D.summary.beterou_observed_runoff.periods;
        return {
            oArea: fmtInt(props('upper_oueme').geodesic_area_km2), gArea: fmtInt(props('upper_ogun').geodesic_area_km2),
            upArea: fmtInt(props('upper_oueme').hydrobasins_up_area_km2),
            oP: fmtInt(o.p_chirps2_mm), gP: fmtInt(g.p_chirps2_mm),
            oPrange: range(PRODS.map(p => o[`p_${p}_mm`])), gPrange: range(PRODS.map(p => g[`p_${p}_mm`])),
            oWet: fmt(B.upper_oueme.period_vs_baseline_pct_chirps2, 1), gWet: fmt(B.upper_ogun.period_vs_baseline_pct_chirps2, 1),
            oET: fmtInt(o.et_wapor_mm), gET: fmtInt(g.et_wapor_mm),
            oETpct: fmtInt(100 * o.et_wapor_mm / o.p_chirps2_mm), gETpct: fmtInt(100 * g.et_wapor_mm / g.p_chirps2_mm),
            oLeft: fmtInt(o.surplus_chirps2_mm), gLeft: fmtInt(g.surplus_chirps2_mm), gLeftRange: range(PRODS.map(p => g[`surplus_${p}_mm`])),
            oQ: fmtInt(o.q_expected_chirps2_mm), oGap: fmtInt(o.closure_residual_chirps2_mm),
            r1: fmt(per['1971-1987'].runoff_ratio, 3), r2: fmt(per['1988-2010'].runoff_ratio, 3), ratio: fmt(ratioObs(), 3),
            gapRange: range(PRODS.map(p => c[p].mean_closure_residual_mm)),
            gapPctRange: range(PRODS.map(p => c[p].residual_pct_of_rainfall), v => fmt(v, 1)),
            riseMin: fmtInt(Math.min(...PRODS.map(p => c[p].water_table_rise_if_stored_m[0]))),
            needRainRange: range(PRODS.map(p => c[p].rain_decrease_needed_pct), v => fmt(v, 1)),
            oSpread: fmtInt(q.upper_oueme_product_spread_mm.mean), gSpread: fmtInt(q.upper_ogun_product_spread_mm.mean),
            v3o: fmtInt(q.upper_oueme_chirps3_minus_chirps2_mm.mean), v3g: fmtInt(q.upper_ogun_chirps3_minus_chirps2_mm.mean),
            v3gMax: fmtInt(q.upper_ogun_chirps3_minus_chirps2_mm.max), wapor: fmt(q.wapor_pcp_minus_chirps3_mm.max_abs, 2),
            ownV2: own.chirps2 ? fmtInt(own.chirps2.mean_closure_residual_mm) : '—', ownV3: own.chirps3 ? fmtInt(own.chirps3.mean_closure_residual_mm) : '—',
            selName: PROD[k], selCum: fmtInt(ck.cumulative_residual_mm),
            selRiseRange: `${fmtInt(ck.water_table_rise_if_stored_m[0])}–${fmtInt(ck.water_table_rise_if_stored_m[1])}`,
            needET: fmt(ck.et_increase_needed_pct, 1), needRain: fmt(ck.rain_decrease_needed_pct, 1), needRatio: fmt(ck.runoff_ratio_needed, 2),
            gUpArea: fmtInt(props('upper_ogun').hydrobasins_up_area_km2),
            needRatioRange: range(PRODS.map(p => c[p].runoff_ratio_needed), v => fmt(v, 2)),
            ratioMult: range(PRODS.map(p => c[p].runoff_ratio_needed / ratioObs()), v => fmt(v, 1)),
            plausRise: fmtInt(D.summary.plausible_rise_m),
            syPlausRange: range(PRODS.map(p => 100 * c[p].sy_for_plausible_rise), v => fmt(v, 1)),
            corrO: agree('upper_oueme', 'pearson_r', v => fmt(v, 2)), madO: agree('upper_oueme', 'mean_abs_diff_mm', fmtInt),
            corrG: agree('upper_ogun', 'pearson_r', v => fmt(v, 2)), madG: agree('upper_ogun', 'mean_abs_diff_mm', fmtInt),
            etCvO: fmt(q.upper_oueme_et_cv_pct, 1), pCvO: range(PRODS.map(p => q.upper_oueme_interannual_cv_pct[p]), v => fmt(v, 1)),
            et10: fmtInt(0.1 * o.et_wapor_mm),
            perHundredth: fmtInt(0.01 * o.p_chirps2_mm),
            resAtDongaLo: fmtInt(Math.max(...PRODS.map(p => residualAt(p, 0.14)))),
            resAtDongaHi: fmtInt(Math.min(...PRODS.map(p => residualAt(p, 0.28)))),
            ownRange: range(Object.values(own).map(v => v.mean_closure_residual_mm)),
            ownDiffRange: (() => { const d = Object.entries(own).map(([p, v]) => v.mean_closure_residual_mm - c[p].mean_closure_residual_mm); return `${fmtInt(Math.min(...d))} to +${fmtInt(Math.max(...d))}`; })(),
            oCellRange: range(D.grid.upper_oueme.values.rain_chirps2.mean), gCellRange: range(D.grid.upper_ogun.values.rain_chirps2.mean)
        };
    }
    // range of one agreement statistic over the three pairs of rainfall products
    const agree = (b, key, f) => {
        const v = Object.values(D.summary.qa[`${b}_product_agreement`]).map(x => x[key]);
        // a range that crosses zero reads better with "to" than with a dash
        return key === 'pearson_r' ? `${f(Math.min(...v))} to ${f(Math.max(...v))}` : range(v, f);
    };
    // mean 2018-2024 residual for product p with runoff ratio r (Eq. 1 and 2)
    const residualAt = (p, r) => { const o = rec('upper_oueme'); return o[`p_${p}_mm`] - o.et_wapor_mm - r * o[`p_${p}_mm`]; };
    function fill() { const v = values(); $$('[data-v]').forEach(el => { if (el.dataset.v in v) el.textContent = v[el.dataset.v]; }); }

    // ---------- Figure 1: locator map ----------
    // Equirectangular, scaled by cos(8.5°) so shapes are true at the centre of the frame. Over 4.4° of
    // longitude this is indistinguishable from a conformal projection at this size.
    const ringsOf = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const pathOf = (g, P) => ringsOf(g).map(poly => poly.map(ring => ring.map((pt, i) => `${i ? 'L' : 'M'}${P(pt).map(n => n.toFixed(1)).join(',')}`).join('') + 'Z').join('')).join('');
    let locSmall = null;
    function drawLocator() {
        const el = $('#locator'); el.innerHTML = '';
        // Text is sized in map units. Below 520 px the map is drawn with larger text so it stays legible,
        // and the Upper Ogun label moves below the catchment, where the larger text fits.
        const small = locSmall = el.getBoundingClientRect().width < 520;
        el.classList.toggle('is-small', small);
        const W = 680, H = 700, frame = { w: 0.6, e: 5.0, s: 5.95, n: 10.8 }, pad = 30;
        const k0 = Math.cos(8.5 * Math.PI / 180);
        const sc = Math.min((W - 2 * pad) / ((frame.e - frame.w) * k0), (H - 2 * pad) / (frame.n - frame.s));
        const ox = (W - (frame.e - frame.w) * k0 * sc) / 2, oy = (H - (frame.n - frame.s) * sc) / 2;
        const P = ([x, y]) => [ox + (x - frame.w) * k0 * sc, oy + (frame.n - y) * sc];
        const [fx0, fy0] = P([frame.w, frame.n]), [fx1, fy1] = P([frame.e, frame.s]);
        const box = { x: fx0, y: fy0, width: fx1 - fx0, height: fy1 - fy0 };
        const clip = svg('clipPath', { id: 'loc-frame' }); clip.append(svg('rect', box));
        el.append(svg('defs')); el.firstChild.append(clip);
        el.append(svg('rect', Object.assign({ class: 'loc-sea' }, box)));
        const g = svg('g', { 'clip-path': 'url(#loc-frame)' });
        CTX.features.filter(f => f.properties.role !== 'inset')
            .forEach(f => g.append(svg('path', { d: pathOf(f.geometry, P), class: `loc-country${['Benin', 'Nigeria'].includes(f.properties.name) ? ' is-study' : ''}` })));
        GEO.features.forEach(f => g.append(svg('path', { d: pathOf(f.geometry, P), class: 'loc-basin' })));
        el.append(g);
        el.append(svg('rect', Object.assign({ class: 'loc-edge' }, box)));
        // graticule ticks outside the frame
        [1, 2, 3, 4].forEach(lon => { const [x] = P([lon, frame.s]); el.append(svg('line', { x1: x, x2: x, y1: fy1, y2: fy1 + 5, class: 'loc-tickline' })); el.append(svg('text', { x, y: fy1 + 18, 'text-anchor': 'middle', class: 'loc-tick' }, `${lon}°E`)); });
        [6, 7, 8, 9, 10].forEach(lat => { const [, y] = P([frame.w, lat]); el.append(svg('line', { x1: fx0 - 5, x2: fx0, y1: y, y2: y, class: 'loc-tickline' })); el.append(svg('text', { x: fx0 - 8, y: y + 4, 'text-anchor': 'end', class: 'loc-tick' }, `${lat}°N`)); });
        const T = (lon, lat, t, cls, o = {}) => { const [x, y] = P([lon, lat]); el.append(svg('text', Object.assign({ x, y, class: cls }, o), t)); };
        T(1.08, 8.55, 'TOGO', 'loc-label', { 'text-anchor': 'middle' });
        T(2.16, 8.05, 'BENIN', 'loc-label', { 'text-anchor': 'middle' });
        T(4.62, 8.95, 'NIGERIA', 'loc-label', { 'text-anchor': 'middle' });
        T(2.95, 6.12, 'Gulf of Guinea', 'loc-sea-label', { 'text-anchor': 'middle' });
        T(2.17, 9.7, 'Upper Ouémé', 'loc-basin-label', { 'text-anchor': 'middle' });
        if (small) T(3.62, 6.98, 'Upper Ogun', 'loc-basin-label is-out', { 'text-anchor': 'middle' });
        else T(4.2, 8.06, 'Upper Ogun', 'loc-basin-label is-out');
        // gauge (triangle, as for hydrometric stations) and the two largest towns near the coast
        const [gx, gy] = P([D.gauge.lon, D.gauge.lat]);
        el.append(svg('path', { d: `M${gx - 6} ${gy - 5}L${gx + 6} ${gy - 5}L${gx} ${gy + 6}Z`, class: 'loc-gauge' }));
        el.append(svg('text', { x: gx + 10, y: gy + 15, class: 'loc-small' }, 'Bétérou gauge'));
        [['Cotonou', 2.42, 6.37], ['Lagos', 3.39, 6.45]].forEach(([n, lon, lat]) => {
            const [x, y] = P([lon, lat]);
            el.append(svg('circle', { cx: x, cy: y, r: 3, class: 'loc-town' }));
            el.append(svg('text', { x: x + 7, y: y - 6, class: 'loc-small' }, n));
        });
        // 100 km scale bar, in the sea, measured at the latitude where it is drawn
        const dx = (100 / (111.32 * Math.cos(6.05 * Math.PI / 180))) * k0 * sc, [sx0, sy0] = P([3.92, 6.05]);
        el.append(svg('path', { d: `M${sx0} ${sy0 - 5}V${sy0}H${sx0 + dx}V${sy0 - 5}`, class: 'loc-scale' }));
        el.append(svg('text', { x: sx0 + dx / 2, y: sy0 - 9, 'text-anchor': 'middle', class: 'loc-small' }, '100 km'));
        // inset: Africa, with the frame of the main map
        const af = CTX.features.find(f => f.properties.role === 'inset');
        if (af) {
            const S2 = 150, ix = fx1 - S2 - 12, iy = fy0 + 12, A = { w: -18, e: 52, s: -35.5, n: 38 };
            const s2 = Math.min((S2 - 16) / (A.e - A.w), (S2 - 16) / (A.n - A.s));
            const Q = ([x, y]) => [ix + 8 + (x - A.w) * s2 + ((S2 - 16) - (A.e - A.w) * s2) / 2, iy + 8 + (A.n - y) * s2];
            el.append(svg('rect', { x: ix, y: iy, width: S2, height: S2, class: 'loc-inset' }));
            el.append(svg('path', { d: pathOf(af.geometry, Q), class: 'loc-inset-land' }));
            const [a0, b0] = Q([frame.w, frame.n]), [a1, b1] = Q([frame.e, frame.s]);
            el.append(svg('rect', { x: a0, y: b0, width: Math.max(4, a1 - a0), height: Math.max(4, b1 - b0), class: 'loc-inset-frame' }));
        }
    }

    // ---------- maps ----------
    const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    function colorFor(v, meta) {
        if (!isNum(v)) return null;
        const t = Math.max(0, Math.min(1, (v - meta.vmin) / (meta.vmax - meta.vmin))), s = meta.stops;
        const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i, a = hex(s[i]), b = hex(s[i + 1]);
        return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * f)).join(',')})`;
    }
    const layerKey = (layer, product) => layer === 'et' ? 'et' : `${layer}_${product}`;
    const annualCol = (layer, product) => layer === 'et' ? 'et_wapor_mm' : layer === 'rain' ? `p_${product}_mm` : `surplus_${product}_mm`;
    const esri = (path, pane = 'tilePane') => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, pane, attribution: 'Basemap © Esri' });

    function gridMap(id, opts) {
        const map = L.map(id, {
            zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25, boxZoom: false,
            dragging: opts.interactive || !coarse, touchZoom: opts.interactive, doubleClickZoom: opts.interactive, keyboard: opts.interactive
        });
        if (opts.interactive) L.control.zoom({ position: 'topright' }).addTo(map);
        map.setView([8.6, 2.9], 7);
        // Place names would be cut off by the cells if drawn under them. The figure map leaves them out; the
        // explorer draws them above the cells, where they do not catch the pointer.
        esri('Canvas/World_Light_Gray_Base').addTo(map);
        if (opts.interactive) {
            const pane = map.createPane('placenames');
            pane.style.zIndex = 450; pane.style.pointerEvents = 'none';
            esri('Canvas/World_Light_Gray_Reference', 'placenames').addTo(map);
        }
        map.createPane('cells').style.zIndex = 380;
        const renderer = L.canvas({ pane: 'cells', padding: 0.4 });
        const outline = L.geoJSON(GEO, { interactive: false, style: { color: '#111', weight: 1.4, fill: false } }).addTo(map);
        // Catchment labels sit outside the catchments so they never cover cells: the Upper Ouémé label
        // above its northern edge, the Upper Ogun label west of it.
        const labels = L.layerGroup().addTo(map), anchors = {}, rects = {};
        outline.eachLayer(l => {
            const b = l.feature.properties.basin_id, bb = l.getBounds();
            if (b !== 'upper_ogun') { anchors[b] = { at: L.latLng(bb.getNorth(), bb.getCenter().lng), side: 'n' }; return; }
            const lat = bb.getCenter().lat, near = ringsOf(l.feature.geometry).flat().flat().filter(([, y]) => Math.abs(y - lat) < 0.08);
            anchors[b] = { at: L.latLng(lat, near.length ? Math.min(...near.map(([x]) => x)) : bb.getWest()), side: 'w' };
        });
        BIDS.forEach(b => {
            const g = D.grid[b], c = g.cell_deg;
            rects[b] = g.cells.map(([s, w]) => {
                const r = L.rectangle([[s, w], [s + c, w + c]], { renderer, weight: 0.5, fillOpacity: 0.92, interactive: !!opts.interactive });
                if (opts.interactive) {
                    r.bindTooltip('', { sticky: true, className: 'tip', direction: 'top', offset: [0, -8] });
                    r.on('mouseover', () => r.setStyle({ weight: 1.6, color: '#111' }));
                    r.on('mouseout', () => r.setStyle({ weight: 0.5, color: r.options.fillColor }));
                    r.on('click', () => opts.onSelect && opts.onSelect(b));
                }
                return r.addTo(map);
            });
        });
        const gauge = L.marker([D.gauge.lat, D.gauge.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'gauge-pin', iconSize: [0, 0], html: '<div></div><span>Bétérou gauge</span>' }) }).addTo(map);
        return {
            map,
            paint(st) {
                const meta = D.layers[st.layer], key = layerKey(st.layer, st.product);
                BIDS.forEach(b => {
                    const vals = D.grid[b].values[key][st.period], dim = st.zone !== 'ALL' && st.zone !== b;
                    rects[b].forEach((r, i) => {
                        const fillColor = colorFor(vals[i], meta) || '#e5e5e5';
                        r.setStyle({ fillColor, color: fillColor, fillOpacity: dim ? 0.4 : 0.92, opacity: dim ? 0.4 : 0.92 });
                        if (opts.interactive) r.setTooltipContent(`<b>${esc(meta.short)}: ${fmtInt(vals[i])} mm</b><br>${esc(BASIN[b])}, one 5 km cell, ${st.period === 'mean' ? '2018–2024 mean' : st.period}${st.layer !== 'et' ? `, ${PROD[st.product]}` : ''}`);
                    });
                });
                outline.setStyle(f => ({ color: '#111', weight: st.zone === f.properties.basin_id ? 2.6 : 1.4, fill: false }));
                labels.clearLayers();
                BIDS.forEach(b => {
                    const v = rec(b, st.period)[annualCol(st.layer, st.product)];
                    labels.addLayer(L.marker(anchors[b].at, { interactive: false, keyboard: false, icon: L.divIcon({ className: `basin-label at-${anchors[b].side}${st.zone === b ? ' is-on' : ''}`, iconSize: [0, 0], html: `<div>${esc(BASIN[b])}<span>${fmtInt(v)} mm, catchment mean</span></div>` }) }));
                });
                const pin = gauge.getElement(); if (pin) pin.classList.toggle('is-on', !!st.gauge);
            },
            fit(zone, animate, pad) {
                map.invalidateSize();
                let bounds = null;
                outline.eachLayer(l => { if (zone === 'ALL' || l.feature.properties.basin_id === zone) bounds = bounds ? bounds.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast()); });
                const o = Object.assign({ paddingTopLeft: [32, 48], paddingBottomRight: [32, 32] }, pad || {}, zone === 'ALL' ? {} : { maxZoom: 9 });
                if (animate && !reduced) map.flyToBounds(bounds, Object.assign({ duration: 0.8 }, o)); else map.fitBounds(bounds, Object.assign({ animate: false }, o));
            }
        };
    }
    function setLegend(p, layer, period, product) {
        const meta = D.layers[layer];
        $(`#${p}-title`).textContent = `${meta.label}, mm per year, ${period === 'mean' ? '2018–2024 mean' : period}`;
        $(`#${p}-source`).textContent = layer === 'et' ? 'WaPOR v3, averaged onto the 5 km grid' : layer === 'rain' ? PROD[product] : `${PROD[product]} minus WaPOR v3`;
        $(`#${p}-ramp`).style.background = `linear-gradient(90deg, ${meta.stops.join(', ')})`;
        $(`#${p}-min`).textContent = `≤ ${fmtInt(meta.vmin)}`;
        $(`#${p}-mid`).textContent = fmtInt((meta.vmin + meta.vmax) / 2);
        $(`#${p}-max`).textContent = `≥ ${fmtInt(meta.vmax)}`;
    }

    // ---------- Figure 2: scroll-driven map ----------
    const STEPS = {
        rain: { layer: 'rain', zone: 'ALL' },
        et: { layer: 'et', zone: 'ALL' },
        left: { layer: 'surplus', zone: 'ALL' },
        gap: { layer: 'surplus', zone: 'upper_oueme', gauge: true }
    };
    let story = null, step = 'rain';
    const storyPad = () => ({ paddingTopLeft: [24, 64], paddingBottomRight: [24, $('#story-legend').offsetHeight + 28] });
    function applyStep(name, animate = true) {
        step = name;
        const st = STEPS[name];
        $$('.step').forEach(s => s.classList.toggle('is-active', s.dataset.step === name));
        setLegend('sl', st.layer, 'mean', 'chirps2');
        story.paint({ layer: st.layer, zone: st.zone, period: 'mean', product: 'chirps2', gauge: st.gauge });
        story.fit(st.zone, animate, storyPad());
    }
    function initStory() {
        story = gridMap('story-map', { interactive: false });
        applyStep('rain', false);
        // Side by side, a step is current when it crosses the middle of the screen. On a phone the cards pass over
        // the map, which fills the top half, so a step is current while its card is in the lower half.
        const narrow = matchMedia('(max-width: 860px)');
        let io = null;
        const observe = () => {
            if (io) io.disconnect();
            io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.target.dataset.step !== step) applyStep(e.target.dataset.step); }),
                { rootMargin: narrow.matches ? '-55% 0px -15% 0px' : '-45% 0px -45% 0px' });
            $$('.step').forEach(s => io.observe(s));
        };
        observe();
        narrow.addEventListener('change', observe);
        new ResizeObserver(() => { story.map.invalidateSize(); story.fit(STEPS[step].zone, false, storyPad()); }).observe($('.scrolly-map'));
        const rs = rowsOf('upper_oueme'), vals = rs.map(r => r.closure_residual_chirps2_mm), max = Math.max(...vals);
        $('#bars7').innerHTML = rs.map(r => `<div style="height:${Math.max(2, 100 * r.closure_residual_chirps2_mm / max)}%"><span>${fmtInt(r.closure_residual_chirps2_mm)}</span></div>`).join('');
        $('#bars7').setAttribute('aria-label', `Annual residual: ${rs.map(r => `${r.year}, ${fmtInt(r.closure_residual_chirps2_mm)} mm`).join('; ')}`);
    }

    // ---------- Tables 2 and 3 ----------
    // ---------- shared chart helpers ----------
    const niceTicks = (lo, hi, step) => { const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(Math.round(v * 1000) / 1000); return t; };
    function axisY(g, ticks, y, x0, x1, fmtT) {
        ticks.forEach(t => {
            g.append(svg('line', { x1: x0, x2: x1, y1: y(t), y2: y(t), class: t === 0 ? 'ch-zero' : 'ch-grid' }));
            g.append(svg('text', { x: x0 - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'ch-tick' }, fmtT(t)));
        });
    }

    // ---------- Figure 3: annual rainfall by product and evapotranspiration ----------
    function renderRainChart() {
        const el = $('#rainchart'); el.innerHTML = '';
        const all = D.annual.flatMap(r => PRODS.map(p => r[`p_${p}_mm`]).concat(r.et_wapor_mm));
        const lo = Math.floor((Math.min(...all) - 50) / 100) * 100, hi = Math.ceil((Math.max(...all) + 50) / 100) * 100;
        const W = 480, H = 300, m = { l: 52, r: 14, t: 34, b: 30 };
        const x = i => m.l + (W - m.l - m.r) * (i / (YEARS.length - 1)), y = v => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
        const series = [...PRODS.map(p => ({ key: `p_${p}_mm`, name: PROD[p], color: pcol(p), cls: 'ch-line' })), { key: 'et_wapor_mm', name: 'Evapotranspiration, WaPOR v3', color: css('--air'), cls: 'ch-line ch-et' }];
        const legend = document.createElement('ul'); legend.className = 'keylist ch-legend';
        legend.innerHTML = series.map(s => `<li><i style="background:${s.color}"></i><span>${s.name}</span></li>`).join('') + '<li><i class="dash"></i><span>Rainfall, 1991–2020 mean (CHIRPS v2.0)</span></li>';
        el.append(legend);
        BIDS.forEach(b => {
            const rows = rowsOf(b), base = D.summary.basins[b].baseline_1991_2020_mean_chirps2_mm;
            const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart' });
            s.setAttribute('aria-label', `${BASIN[b]}: annual rainfall and evapotranspiration 2018–2024. ` + rows.map(r => `${r.year}: ${PRODS.map(p => `${PROD[p]} ${fmtInt(r[`p_${p}_mm`])}`).join(', ')}, ET ${fmtInt(r.et_wapor_mm)} mm`).join('; '));
            s.append(svg('text', { x: m.l, y: 16, class: 'ch-title' }, BASIN[b]));
            axisY(s, niceTicks(lo, hi, 200), y, m.l, W - m.r, fmtInt);
            YEARS.forEach((yr, i) => s.append(svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'ch-tick' }, yr)));
            s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(base), y2: y(base), class: 'ch-base' }));
            series.forEach(se => {
                s.append(svg('path', { d: rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r[se.key]).toFixed(1)}`).join(''), class: se.cls, stroke: se.color }));
                rows.forEach((r, i) => {
                    const c = svg('circle', { cx: x(i), cy: y(r[se.key]), r: 4, fill: se.color, class: 'ch-pt' });
                    c.append(svg('title', {}, `${BASIN[b]}, ${r.year}: ${se.name} ${fmtInt(r[se.key])} mm`));
                    s.append(c);
                });
            });
            el.append(s);
        });
    }

    // ---------- Figure 5: residual against the runoff ratio ----------
    function renderRatioChart() {
        const el = $('#ratiochart'); el.innerHTML = '';
        const sens = D.summary.runoff_ratio_sensitivity, rr = sens.ratio, ref = sens.reference_ratios;
        const vals = PRODS.flatMap(p => sens.mean_residual_mm[p]);
        const lo = Math.floor(Math.min(0, ...vals) / 50) * 50, hi = Math.ceil(Math.max(...vals) / 50) * 50;
        const W = 680, H = 360, m = { l: 56, r: 16, t: 20, b: 46 };
        const x = v => m.l + (W - m.l - m.r) * (v - rr[0]) / (rr[rr.length - 1] - rr[0]), y = v => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart' });
        const [d0, d1] = ref.donga_single_years_kamagate2007, [b0, b1] = ref.beterou_1971_2010;
        s.append(svg('rect', { x: x(d0), y: m.t, width: x(d1) - x(d0), height: H - m.t - m.b, class: 'ch-band' }));
        s.append(svg('rect', { x: x(b0), y: m.t, width: Math.max(2, x(b1) - x(b0)), height: H - m.t - m.b, class: 'ch-band-dark' }));
        axisY(s, niceTicks(lo, hi, 50), y, m.l, W - m.r, fmtInt);
        niceTicks(rr[0], rr[rr.length - 1], 0.05).forEach(t => s.append(svg('text', { x: x(t), y: H - m.b + 18, 'text-anchor': 'middle', class: 'ch-tick' }, fmt(t, 2))));
        s.append(svg('text', { x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle', class: 'ch-axis' }, 'Runoff ratio r'));
        s.append(svg('text', { x: 14, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'ch-axis', transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})` }, 'Mean residual ε, mm per year'));
        s.append(svg('text', { x: x(d0) + 6, y: m.t + 14, class: 'ch-note' }, 'Donga, single years'));
        s.append(svg('text', { x: x(b1) + 6, y: m.t + 30, class: 'ch-note' }, 'Bétérou 1971–2010'));
        PRODS.forEach(p => {
            const v = sens.mean_residual_mm[p];
            s.append(svg('path', { d: rr.map((r, i) => `${i ? 'L' : 'M'}${x(r).toFixed(1)} ${y(v[i]).toFixed(1)}`).join(''), class: 'ch-line', stroke: pcol(p) }));
            const need = D.summary.closure_upper_oueme_2018_2024[p].runoff_ratio_needed;
            const c = svg('circle', { cx: x(need), cy: y(0), r: 4.5, fill: pcol(p), class: 'ch-pt' });
            c.append(svg('title', {}, `${PROD[p]}: balance closes at r = ${fmt(need, 3)}`));
            s.append(c);
        });
        const legend = document.createElement('ul'); legend.className = 'keylist ch-legend';
        legend.innerHTML = PRODS.map(p => `<li><i style="background:${pcol(p)}"></i><span>${PROD[p]}</span></li>`).join('') + '<li><i class="dot"></i><span>Ratio that closes the balance</span></li>';
        el.append(legend);
        s.setAttribute('aria-label', `Mean residual against runoff ratio. ${PRODS.map(p => `${PROD[p]}: ${fmtInt(sens.mean_residual_mm[p][0])} mm at r = ${fmt(rr[0], 2)}, zero at r = ${fmt(D.summary.closure_upper_oueme_2018_2024[p].runoff_ratio_needed, 2)}`).join('; ')}.`);
        el.append(s);
    }

    // ---------- Table 4: sources of uncertainty ----------
    function renderUncertainty() {
        const o = rec('upper_oueme'), r = ratioObs(), obs = D.summary.beterou_observed_runoff, own = D.summary.closure_check_own_product_ratio;
        const res = (p, rr = r, etf = 1) => o[`p_${p}_mm`] - etf * o.et_wapor_mm - rr * o[`p_${p}_mm`];
        const span = f => range(PRODS.flatMap(f));
        const A = obs.area_km2, areas = [obs.published_area_km2[0], props('upper_oueme').hydrobasins_up_area_km2];
        const rows = [
            ['Rainfall product (Table 2)', `CHIRPS v2.0, CHIRPS v3.0, TAMSAT v3.1, with <var>r</var> = ${fmt(r, 3)}`, span(p => [res(p)])],
            ['Runoff ratio, observed', `<var>r</var> = ${fmt(obs.periods['1971-1987'].runoff_ratio, 3)} (1971–1987) instead of ${fmt(r, 3)}`, span(p => [res(p, obs.periods['1971-1987'].runoff_ratio)])],
            ['Runoff ratio, rainfall basis', 'Each product\'s own 1988–2010 rainfall instead of gauge rainfall', range(Object.values(own).map(v => v.mean_closure_residual_mm))],
            ['Runoff ratio, single years', '0.14–0.28, Donga sub-basin (Kamagaté et al., 2007)', range(PRODS.flatMap(p => [res(p, 0.14), res(p, 0.28)]))],
            ['Evapotranspiration', 'WaPOR v3 ± 10%', span(p => [res(p, r, 1.1), res(p, r, 0.9)])],
            ['Catchment area', `${fmtInt(areas[0])}–${fmtInt(areas[1])} km² instead of ${fmtInt(A)} km²`, span(p => areas.map(a => res(p, r * A / a)))]
        ];
        $('#table-unc tbody').innerHTML = rows.map(([a, b, c]) => `<tr><td class="text">${a}</td><td class="text">${b}</td><td>${c}</td></tr>`).join('');
    }

    function renderTables() {
        const o = rec('upper_oueme'), g = rec('upper_ogun'), c = clo();
        $('#table-2 tbody').innerHTML = PRODS.map(p => `<tr><td><span class="swatch" style="background:${pcol(p)}"></span>${PROD[p]}</td><td>${fmtInt(o[`p_${p}_mm`])}</td><td>${fmtInt(o.et_wapor_mm)}</td><td>${fmtInt(o[`surplus_${p}_mm`])}</td><td>${fmtInt(o[`q_expected_${p}_mm`])}</td><td>${fmtInt(c[p].mean_closure_residual_mm)}</td><td>${fmt(c[p].residual_pct_of_rainfall, 1)}</td></tr>`).join('');
        $('#table-3 tbody').innerHTML = PRODS.map(p => `<tr><td><span class="swatch" style="background:${pcol(p)}"></span>${PROD[p]}</td><td>${fmtInt(g[`p_${p}_mm`])}</td><td>${fmtInt(g.et_wapor_mm)}</td><td>${fmtInt(g[`surplus_${p}_mm`])}</td></tr>`).join('');
    }

    // ---------- product selectors (Figures 3 and 5) ----------
    // Buttons are built once and then only their pressed state changes, so keyboard focus is never lost.
    function buildProdSegs() {
        $$('[data-prod-seg]').forEach(seg => {
            seg.innerHTML = PRODS.map(p => `<button type="button" data-prod="${p}"><span class="swatch" style="background:${pcol(p)}"></span>${PROD[p]}</button>`).join('');
        });
        syncProdSegs();
    }
    const syncProdSegs = () => $$('[data-prod]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prod === S.product)));
    function setProduct(p) { S.product = p; fill(); syncProdSegs(); drawSection(); renderScale(); resetFix(); writeQuery(); }

    // ---------- Figure 3: storage ----------
    function drawSection() {
        const c = clo()[S.product], cum = c.cumulative_residual_mm, rise = cum / (S.sy / 100 * 1000);
        $('#sy-out').textContent = `${fmt(S.sy, 1)}%`;
        $('#sy').setAttribute('aria-valuetext', `${fmt(S.sy, 1)} percent`);
        $('#rise-out').textContent = fmtInt(rise);
        // Schematic weathering profile of a crystalline-basement aquifer, after Lachassagne et al. (2021).
        // Depth axis on the left; 2.1 px per metre, so the frame shows 71 m above the ground surface. It is drawn
        // at the width it is shown (340–640 units), so the text stays legible on a phone.
        const el = $('#section'); el.innerHTML = '';
        const W = Math.round(Math.max(340, Math.min(640, el.getBoundingClientRect().width || 640)));
        el.setAttribute('viewBox', `0 0 ${W} 400`);
        const X0 = 44, ground = 150, pxm = 2.1, y = m => ground + m * pxm, WT = 12;
        const T = (x, yy, t, cls = 'sec-text', o = {}) => svg('text', Object.assign({ x, y: yy, class: cls }, o), t);
        el.append(svg('rect', { x: X0, y: 0, width: W - X0, height: ground, class: 'sec-air' }));
        [[0, 5, 'sec-laterite'], [5, 45, 'sec-saprolite'], [45, 100, 'sec-fissured'], [100, 125, 'sec-bedrock']]
            .forEach(([a, b, c]) => el.append(svg('rect', { x: X0, y: y(a), width: W - X0, height: (b - a) * pxm, class: c })));
        // sub-horizontal fissures, denser near the top of the fissured layer
        [[50, 0.9], [55, 0.75], [61, 0.6], [68, 0.45], [76, 0.35], [85, 0.25], [93, 0.15]].forEach(([m, density], r) => {
            for (let x = X0 + 18 + (r % 2) * 23; x < W - 30; x += 46 / density) el.append(svg('line', { x1: x, x2: x + 18, y1: y(m), y2: y(m) + (r % 2 ? 1.5 : -1.5), class: 'sec-fissure' }));
        });
        el.append(svg('line', { x1: X0, x2: W, y1: ground, y2: ground, class: 'sec-ground' }));
        el.append(T(X0 + 12, ground - 7, 'ground surface', 'sec-note'));
        el.append(T(X0 + 12, y(30), 'Saprolite'));
        el.append(T(X0 + 12, y(30) + 16, 'weathered rock, most of the storage', 'sec-note'));
        el.append(T(X0 + 12, y(80), 'Fissured layer'));
        el.append(T(X0 + 12, y(112) + 4, 'Fresh bedrock', 'sec-text sec-on-dark'));
        // depth axis
        el.append(svg('line', { x1: X0, x2: X0, y1: ground, y2: y(118), class: 'sec-axis' }));
        [0, 25, 50, 75, 100].forEach(m => {
            el.append(svg('line', { x1: X0 - 5, x2: X0, y1: y(m), y2: y(m), class: 'sec-axis' }));
            el.append(T(X0 - 8, y(m) + 4, m === 0 ? '0 m' : `${m}`, 'sec-tick', { 'text-anchor': 'end' }));
        });
        // water table today and the level needed to hold the residual
        const wt = y(WT), need = wt - rise * pxm, top = Math.max(8, need), off = need < 8;
        const bx0 = X0 + Math.round((W - X0) * 0.34), bx1 = W - 16, ax = bx0 + 22, ly = Math.max(26, top + 22);
        el.append(svg('rect', { x: bx0, y: top, width: bx1 - bx0, height: wt - top, class: 'sec-rise' }));
        el.append(svg('line', { x1: X0, x2: W, y1: wt, y2: wt, class: 'sec-wt' }));
        el.append(T(X0 + 12, wt + 16, 'water table today (illustrative depth)', 'sec-note'));
        if (!off) el.append(svg('line', { x1: bx0, x2: bx1, y1: need, y2: need, class: 'sec-need' }));
        el.append(svg('path', { d: `M${ax} ${wt - 3}V${top + 4}M${ax - 7} ${top + 14}L${ax} ${top + 3}L${ax + 7} ${top + 14}`, class: 'sec-arrow' }));
        const above = rise - WT;
        el.append(T(ax + 12, ly, `+${fmtInt(rise)} m${off ? ', beyond the frame' : ''}`, 'sec-label'));
        if (above > 0) el.append(T(ax + 12, ly + 17, `${fmtInt(above)} m above ground`, 'sec-note'));
        el.setAttribute('aria-label', `Schematic profile: storing ${fmtInt(cum)} mm with a specific yield of ${fmt(S.sy, 1)}% needs a water-table rise of ${fmtInt(rise)} m${above > 0 ? `, to ${fmtInt(above)} m above the ground surface` : ''}.`);
    }

    // ---------- Figure 4: published recharge ----------
    function renderScale() {
        const c = clo(), rf = D.summary.published_recharge_fraction, X = 25, pos = v => `${Math.min(100, 100 * v / X)}%`;
        const [ka, kb] = rf.kamagate2007, ko = rf.kotchoni2019[0];
        $('#scale').innerHTML = `<div class="scale-plot"><div class="scale-grid">${[0, 5, 10, 15, 20, 25].map(t => `<span style="left:${pos(t)}"></span>`).join('')}</div>` +
            `<div class="scale-row"><div class="scale-name">Residual, this study<span>Upper Ouémé, 2018–2024</span></div><div class="scale-track">${PRODS.map(p => `<span class="scale-dot ${p === S.product ? 'is-on' : ''}" style="left:${pos(c[p].residual_pct_of_rainfall)};background:${pcol(p)}" title="${PROD[p]}: ${fmt(c[p].residual_pct_of_rainfall, 1)}%"></span>`).join('')}</div></div>` +
            `<div class="scale-row"><div class="scale-name">Kamagaté et al. (2007)<span>Donga sub-basin, 2 years</span></div><div class="scale-track"><span class="scale-range" style="left:${pos(100 * ka)};width:${100 * (kb - ka) * 100 / X}%"></span><span class="scale-val" style="left:calc(${pos(100 * ka)} + 6px);top:-12px">${fmtInt(100 * ka)}–${fmtInt(100 * kb)}%</span></div></div>` +
            `<div class="scale-row"><div class="scale-name">Kotchoni et al. (2019)<span>Benin, 19–25-year records</span></div><div class="scale-track"><span class="scale-tick" style="left:${pos(100 * ko)}"></span><span class="scale-val" style="left:calc(${pos(100 * ko)} + 8px)">about ${fmtInt(100 * ko)}%</span></div></div>` +
            `<div class="scale-axis"><div></div><div class="scale-ticks">${[0, 5, 10, 15, 20, 25].map(t => `<span style="left:${pos(t)}">${t}%</span>`).join('')}</div></div></div>` +
            `<p class="small" style="margin:8px 0 0">${PRODS.map(p => `<span style="white-space:nowrap"><span class="swatch" style="background:${pcol(p)}"></span>${PROD[p]} ${fmt(c[p].residual_pct_of_rainfall, 1)}%</span>`).join('&ensp; ')}</p>`;
        $('#scale').setAttribute('aria-label', `Share of annual rainfall. Residual, this study: ${PRODS.map(p => `${PROD[p]} ${fmt(c[p].residual_pct_of_rainfall, 1)}%`).join(', ')}. Kamagaté et al. (2007): ${fmtInt(100 * ka)}–${fmtInt(100 * kb)}%. Kotchoni et al. (2019): about ${fmtInt(100 * ko)}%.`);
    }

    // ---------- Figure 5: sensitivity ----------
    function resetFix() { S.fx = { et: 0, rain: 0, ratio: ratioObs() }; syncFix(); }
    function syncFix() { $('#fx-et').value = S.fx.et; $('#fx-rain').value = S.fx.rain; $('#fx-ratio').value = S.fx.ratio; renderFix(); }
    function renderFix() {
        const o = rec('upper_oueme'), k = S.product, f = S.fx;
        const P = o[`p_${k}_mm`] * (1 + f.rain / 100), ET = o.et_wapor_mm * (1 + f.et / 100), Q = f.ratio * P, gap = P - ET - Q;
        $('#fx-et-out').textContent = `${signed(f.et)}%`;
        $('#fx-rain-out').textContent = `${signed(f.rain)}%`;
        $('#fx-ratio-out').textContent = fmt(f.ratio, 3);
        $('#fx-et').setAttribute('aria-valuetext', `${signed(f.et)} percent`);
        $('#fx-rain').setAttribute('aria-valuetext', `${signed(f.rain)} percent`);
        $('#fx-gap').textContent = fmtInt(gap);
        // Rainfall is drawn as a bracket; evapotranspiration, river flow and a positive residual fill it.
        // A negative residual shows as segments running past the end of the bracket.
        const tot = Math.max(P, ET + Q), pct = v => `${100 * v / tot}%`;
        const parts = [['s-air', ET], ['s-river', Q]].concat(gap > 0.5 ? [['s-gap', gap]] : []);
        $('#fx-bar').innerHTML = `<div class="budget-p" style="width:${pct(P)}"><span>Rainfall ${fmtInt(P)} mm</span></div>` +
            `<div class="stack">${parts.map(([c, v]) => `<div class="${c}" style="width:${pct(v)}">${v / tot > 0.1 ? fmtInt(v) : ''}</div>`).join('')}</div>`;
        $('#fx-keys').innerHTML = [['var(--air)', 'Evapotranspiration', ET], ['var(--river-fill)', 'Expected river flow', Q], ['var(--gap)', 'Residual', gap]]
            .map(([c, n, v]) => `<li><i style="background:${c}"></i><span>${n}</span><b>${fmtInt(v)} mm</b></li>`).join('');
        const st = $('#fx-status'), closed = Math.abs(gap) <= 5;
        st.className = `status${closed ? ' ok' : ''}`;
        st.textContent = closed ? `Residual ${fmtInt(gap)} mm: balanced within ±5 mm.`
            : gap > 0 ? `Residual ${fmtInt(gap)} mm: rainfall exceeds evapotranspiration plus river flow.`
            : `Residual ${fmtInt(gap)} mm: evapotranspiration plus river flow exceed rainfall.`;
    }
    function initFix() {
        $('#fx-et').addEventListener('input', e => { S.fx.et = Number(e.target.value); renderFix(); });
        $('#fx-rain').addEventListener('input', e => { S.fx.rain = Number(e.target.value); renderFix(); });
        $('#fx-ratio').addEventListener('input', e => { S.fx.ratio = Number(e.target.value); renderFix(); });
        $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
            const c = clo()[S.product];
            S.fx = { et: 0, rain: 0, ratio: ratioObs() };
            if (b.dataset.preset === 'et') S.fx.et = Math.round(c.et_increase_needed_pct * 10) / 10;
            if (b.dataset.preset === 'rain') S.fx.rain = -Math.round(c.rain_decrease_needed_pct * 10) / 10;
            if (b.dataset.preset === 'ratio') S.fx.ratio = Math.round(c.runoff_ratio_needed * 1000) / 1000;
            syncFix();
        }));
        $('#sy').addEventListener('input', e => { S.sy = Number(e.target.value); drawSection(); });
        let secW = 0;
        new ResizeObserver(es => { const w = Math.round(es[0].contentRect.width); if (w !== secW) { secW = w; drawSection(); } }).observe($('#section'));
    }

    // ---------- Figure 6 / Table 4: explorer ----------
    let ex = null, timer = null;
    const LAYERS = { surplus: 'Rainfall − ET', rain: 'Rainfall', et: 'Evapotranspiration' };
    function buildExControls() {
        $('#ex-zone').innerHTML = [['ALL', 'Both'], ['upper_oueme', 'Upper Ouémé'], ['upper_ogun', 'Upper Ogun']].map(([v, t]) => `<button type="button" data-zone="${v}">${t}</button>`).join('');
        $('#ex-layer').innerHTML = Object.entries(LAYERS).map(([v, t]) => `<button type="button" data-layer="${v}">${t}</button>`).join('');
        $('#ex-prod').innerHTML = PRODS.map(p => `<button type="button" data-xprod="${p}"><span class="swatch" style="background:${pcol(p)}"></span>${PROD[p]}</button>`).join('');
        $('#ex-year').innerHTML = [['mean', 'Mean']].concat(YEARS.map(y => [y, y])).map(([v, t]) => `<button type="button" data-year="${v}">${t}</button>`).join('');
    }
    function syncExControls() {
        const E = S.ex, press = (sel, key, val) => $$(sel).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === val)));
        press('#ex-zone button', 'zone', E.zone);
        press('#ex-layer button', 'layer', E.layer);
        press('#ex-prod button', 'xprod', E.product);
        press('#ex-year button', 'year', E.period);
        $$('#ex-prod button').forEach(b => { b.disabled = E.layer === 'et'; b.title = E.layer === 'et' ? 'Evapotranspiration does not depend on the rainfall product' : ''; });
        $('#ex-play').innerHTML = timer
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
        $('#ex-play').setAttribute('aria-label', timer ? 'Pause' : 'Play through the years');
    }
    function renderExSide() {
        const E = S.ex, k = E.product, list = E.zone === 'ALL' ? BIDS : [E.zone], when = E.period === 'mean' ? '2018–2024 mean' : E.period;
        $('#ex-side').innerHTML = list.map(b => {
            const r = rec(b, E.period), oue = b === 'upper_oueme';
            const cls = E.period === 'mean' ? (() => { const c = D.summary.basins[b].rain_class_counts_chirps2; return `${c.wet} wet, ${c.normal} normal, ${c.dry} dry`; })() : r.rain_class_chirps2;
            return `<div class="basin"><h3>${esc(BASIN[b])}</h3><p class="when">${when}, ${PROD[k]}</p><dl>
                <dt>Rainfall</dt><dd>${fmtInt(r[`p_${k}_mm`])} mm</dd><dt>Evapotranspiration</dt><dd>${fmtInt(r.et_wapor_mm)} mm</dd><dt>Rainfall − ET</dt><dd>${fmtInt(r[`surplus_${k}_mm`])} mm</dd>
                ${oue ? `<dt>Expected river flow</dt><dd>${fmtInt(r[`q_expected_${k}_mm`])} mm</dd><dt>Residual</dt><dd>${fmtInt(r[`closure_residual_${k}_mm`])} mm</dd>` : '<dt>River flow</dt><dd>no record</dd>'}
                <dt>Years vs 1991–2020</dt><dd>${esc(cls)}</dd></dl></div>`;
        }).join('');
    }
    function renderExTable() {
        const E = S.ex, k = E.product, list = E.zone === 'ALL' ? BIDS : [E.zone], two = list.length > 1;
        const head = `<thead><tr>${two ? '<th class="text">Catchment</th>' : ''}<th class="text">Year</th><th class="text">Class</th><th><var>P</var></th><th><var>ET</var></th><th><var>P</var> − <var>ET</var></th><th><var>Q</var></th><th><var>ε</var></th></tr></thead>`;
        const cell = v => isNum(v) ? fmtInt(v) : '—';
        const row = (b, r, avg) => {
            const year = avg ? 'mean' : String(r.year), on = E.period === year;
            return `<tr class="${avg ? 'avg' : ''}${on ? ' is-on' : ''}" data-year="${year}" data-key="${b}-${year}">${two ? `<td class="text">${esc(BASIN[b])}</td>` : ''}` +
                `<td class="text"><button type="button" class="yr" aria-pressed="${on}">${avg ? 'Mean' : r.year}</button></td><td class="text">${avg ? '' : esc(r.rain_class_chirps2)}</td>` +
                `<td>${cell(r[`p_${k}_mm`])}</td><td>${cell(r.et_wapor_mm)}</td><td>${cell(r[`surplus_${k}_mm`])}</td><td>${cell(r[`q_expected_${k}_mm`])}</td><td>${cell(r[`closure_residual_${k}_mm`])}</td></tr>`;
        };
        $('#ex-table').innerHTML = head + '<tbody>' + list.map(b => rowsOf(b).map(r => row(b, r, false)).join('') + row(b, rec(b), true)).join('') + '</tbody>';
    }
    const exPad = () => ({ paddingTopLeft: [32, 56], paddingBottomRight: [32, $('#ex-legend').offsetHeight + 28] });
    function setEx(change, refit) {
        // The table is rebuilt, so a focused year button in it gets its focus back afterwards.
        const f = document.activeElement, refocus = f && f.matches('#ex-table .yr') ? f.closest('tr').dataset.key : null;
        Object.assign(S.ex, change);
        syncExControls();
        setLegend('el', S.ex.layer, S.ex.period, S.ex.product);
        ex.paint({ layer: S.ex.layer, zone: S.ex.zone, period: S.ex.period, product: S.ex.product, gauge: false });
        if (refit) ex.fit(S.ex.zone, true, exPad());
        renderExSide(); renderExTable(); writeQuery();
        if (wrapCheck) wrapCheck($('#ex-table').closest('.table-wrap'));
        if (refocus) { const b = $(`#ex-table tr[data-key="${refocus}"] .yr`); if (b) b.focus(); }
    }
    function stop() { if (timer) clearInterval(timer); timer = null; syncExControls(); }
    function initExplorer() {
        ex = gridMap('explore-map', { interactive: true, onSelect: b => setEx({ zone: b }) });
        buildExControls();
        $('#ex-table').addEventListener('click', e => { const tr = e.target.closest('tbody tr[data-year]'); if (tr) { stop(); setEx({ period: tr.dataset.year }); } });
        $('#ex-zone').addEventListener('click', e => { const b = e.target.closest('[data-zone]'); if (b) setEx({ zone: b.dataset.zone }, true); });
        $('#ex-layer').addEventListener('click', e => { const b = e.target.closest('[data-layer]'); if (b) setEx({ layer: b.dataset.layer }); });
        $('#ex-prod').addEventListener('click', e => { const b = e.target.closest('[data-xprod]'); if (b && !b.disabled) setEx({ product: b.dataset.xprod }); });
        $('#ex-year').addEventListener('click', e => { const b = e.target.closest('[data-year]'); if (b) { stop(); setEx({ period: b.dataset.year }); } });
        $('#ex-play').addEventListener('click', () => {
            if (timer) return stop();
            let i = S.ex.period === 'mean' ? -1 : YEARS.indexOf(S.ex.period);
            const next = () => { i += 1; if (i >= YEARS.length) return stop(); setEx({ period: YEARS[i] }); };
            timer = setInterval(next, 1000); next();
        });
        setEx({}, false);
        ex.fit(S.ex.zone, false, exPad());
        new ResizeObserver(() => ex.map.invalidateSize()).observe($('.explorer-map'));
    }

    // ---------- URL state ----------
    function writeQuery() {
        const p = new URLSearchParams();
        if (S.ex.zone !== 'ALL') p.set('zone', S.ex.zone);
        if (S.ex.layer !== 'surplus') p.set('layer', S.ex.layer);
        if (S.ex.period !== 'mean') p.set('year', S.ex.period);
        if (S.ex.product !== 'chirps2') p.set('rain', S.ex.product);
        if (S.product !== 'chirps2') p.set('product', S.product);
        const q = p.toString();
        try { history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`); } catch (e) {}
    }
    function readQuery() {
        const p = new URLSearchParams(location.search);
        if (BIDS.includes(p.get('zone'))) S.ex.zone = p.get('zone');
        if (LAYERS[p.get('layer')]) S.ex.layer = p.get('layer');
        if (YEARS.includes(p.get('year'))) S.ex.period = p.get('year');
        if (PROD[p.get('rain')]) S.ex.product = p.get('rain');
        if (PROD[p.get('product')]) S.product = p.get('product');
    }

    // ---------- section navigation, citation ----------
    function initNav() {
        // The current section is the last one whose heading has passed 30% of the viewport height. This also
        // holds for the figures between sections, which an intersection test on the sections would miss.
        const links = $$('.toc a'), targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
        let queued = false, current = null;
        const update = () => {
            queued = false;
            const line = innerHeight * 0.3;
            let i = -1;
            targets.forEach((t, j) => { if (t && t.getBoundingClientRect().top <= line) i = j; });
            if (i === current) return;
            current = i;
            links.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        };
        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
        addEventListener('resize', update);
        update();
        $('#copy-cite').addEventListener('click', () => {
            const t = $('#cite-text').textContent.replace(/\s+/g, ' ').trim();
            const done = () => snack('Citation copied');
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => window.prompt('Copy the citation:', t));
            else window.prompt('Copy the citation:', t);
        });
        document.addEventListener('click', e => { const b = e.target.closest('[data-prod]'); if (b) setProduct(b.dataset.prod); });
    }
    // A table that scrolls sideways must be reachable by keyboard; one that fits must not add a tab stop.
    let wrapCheck = null;
    function initTableWraps() {
        const check = wrapCheck = w => {
            const fig = w.closest('figure'), cap = fig && $('figcaption', fig);
            if (w.scrollWidth > w.clientWidth + 1 && cap) { w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-labelledby', cap.id); }
            else ['tabindex', 'role', 'aria-labelledby'].forEach(a => w.removeAttribute(a));
        };
        const ro = new ResizeObserver(es => es.forEach(e => check(e.target)));
        $$('.table-wrap').forEach(w => { check(w); ro.observe(w); });
    }
    function snack(msg) { const el = document.createElement('div'); el.className = 'snack'; el.setAttribute('role', 'status'); el.textContent = msg; document.body.append(el); setTimeout(() => el.remove(), 2000); }

    // ---------- start ----------
    const get = (u, json = true) => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return json ? r.json() : r.text(); });
    Promise.all([get('data/app_data.json'), get('data/basins.geojson'), get('data/context.geojson')]).then(([data, geo, ctx]) => {
        D = data; GEO = geo; CTX = ctx;
        readQuery();
        S.fx.ratio = ratioObs();
        fill();
        drawLocator();
        new ResizeObserver(() => { if (($('#locator').getBoundingClientRect().width < 520) !== locSmall) drawLocator(); }).observe($('#locator'));
        renderTables();
        renderRainChart();
        renderRatioChart();
        renderUncertainty();
        buildProdSegs();
        drawSection();
        renderScale();
        initFix(); syncFix();
        initNav();
        initStory();
        initExplorer();
        initTableWraps();
    }).catch(err => {
        console.error(err);
        const m = document.createElement('p');
        m.className = 'small'; m.style.cssText = 'grid-column: main; padding: 16px 0';
        m.textContent = `The data could not be loaded (${err.message}). Reload the page to try again.`;
        $('main').prepend(m);
    });
})();
