/* The Missing Millimetres: story, interactive chapters and data explorer.
   Every number on the page is computed here from data/app_data.json, which scripts/06_build_app.py
   writes from the analysis outputs. Nothing is typed in by hand. */
(function () {
    'use strict';

    // ---------- helpers ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const isNum = v => v !== null && v !== undefined && Number.isFinite(Number(v));
    const fmtInt = v => isNum(v) ? Math.round(v).toLocaleString('en-GB') : '—';
    const fmt = (v, d = 1) => isNum(v) ? Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
    const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v), d);
    const range = (vals, f = fmtInt) => { const v = vals.filter(isNum); const a = f(Math.min(...v)), b = f(Math.max(...v)); return a === b ? a : `${a}–${b}`; };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text !== undefined) e.textContent = text; return e; };

    const YEARS = ['2018', '2019', '2020', '2021', '2022', '2023', '2024'];
    const PRODS = ['chirps2', 'chirps3', 'tamsat'];
    const PROD = { chirps2: 'CHIRPS v2.0', chirps3: 'CHIRPS v3.0', tamsat: 'TAMSAT v3.1' };
    const pcol = k => css(`--p-${k}`);
    const BIDS = ['upper_oueme', 'upper_ogun'];
    const BASIN = {
        upper_oueme: { short: 'Upper Ouémé', full: 'Upper Ouémé at Bétérou', country: 'Benin' },
        upper_ogun: { short: 'Upper Ogun', full: 'Upper Ogun above the Oyan confluence', country: 'Nigeria' }
    };

    const S = { product: 'chirps2', sy: 1.5, ex: { zone: 'ALL', layer: 'surplus', period: 'mean', product: 'chirps2' } };
    let D = null, GEO = null;

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
    const area = b => GEO.features.find(f => f.properties.basin_id === b).properties.geodesic_area_km2;
    const ratioObs = () => D.summary.beterou_observed_runoff.ratio_range[1];

    // ---------- every templated number ----------
    function values() {
        const o = rec('upper_oueme'), g = rec('upper_ogun'), c = clo(), q = D.summary.qa, k = S.product, ck = c[k];
        const own = D.summary.closure_check_own_product_ratio || {};
        return {
            oP: fmtInt(o.p_chirps2_mm), oPmm: `${fmtInt(o.p_chirps2_mm)} mm`, oET: fmtInt(o.et_wapor_mm), oETpct: fmtInt(100 * o.et_wapor_mm / o.p_chirps2_mm),
            oLeft: fmtInt(o.surplus_chirps2_mm), oQ: fmtInt(o.q_expected_chirps2_mm), oGap: fmtInt(o.closure_residual_chirps2_mm),
            gP: fmtInt(g.p_chirps2_mm), gET: fmtInt(g.et_wapor_mm), gLeft: fmtInt(g.surplus_chirps2_mm),
            gLeftRange: range(PRODS.map(p => g[`surplus_${p}_mm`])),
            oArea: fmtInt(area('upper_oueme')), gArea: fmtInt(area('upper_ogun')),
            ratio: fmt(ratioObs(), 3),
            gapRange: range(PRODS.map(p => c[p].mean_closure_residual_mm)),
            gapPctRange: range(PRODS.map(p => c[p].residual_pct_of_rainfall), v => fmt(v, 1)),
            needRainRange: range(PRODS.map(p => c[p].rain_decrease_needed_pct), v => fmt(v, 1)),
            oSpread: fmtInt(q.upper_oueme_product_spread_mm.mean), gSpread: fmtInt(q.upper_ogun_product_spread_mm.mean),
            v3o: fmtInt(q.upper_oueme_chirps3_minus_chirps2_mm.mean), v3g: fmtInt(q.upper_ogun_chirps3_minus_chirps2_mm.mean),
            v3gMax: fmtInt(q.upper_ogun_chirps3_minus_chirps2_mm.max), wapor: fmt(q.wapor_pcp_minus_chirps3_mm.max_abs, 2),
            ownV2: own.chirps2 ? fmtInt(own.chirps2.mean_closure_residual_mm) : '—', ownV3: own.chirps3 ? fmtInt(own.chirps3.mean_closure_residual_mm) : '—',
            selName: PROD[k], selGap: fmtInt(ck.mean_closure_residual_mm), selGapPct: fmt(ck.residual_pct_of_rainfall, 1), selCum: fmtInt(ck.cumulative_residual_mm)
        };
    }
    function fill() { const v = values(); $$('[data-v]').forEach(el => { if (el.dataset.v in v) el.textContent = v[el.dataset.v]; }); }

    // ---------- hero: ledger and rain gauge ----------
    function animateLedger() {
        const items = $$('#ledger li');
        if (reduced) { items.forEach(li => li.classList.add('in')); return; }
        items.forEach((li, i) => setTimeout(() => li.classList.add('in'), 250 + i * 420));
    }

    function drawGauge() {
        const svg = $('#gauge'); svg.innerHTML = '';
        const o = rec('upper_oueme'), P = o.p_chirps2_mm;
        const parts = [
            { v: o.et_wapor_mm, c: css('--air'), name: 'back to the sky', id: 'air' },
            { v: o.q_expected_chirps2_mm, c: css('--river'), name: 'in the river', id: 'river' },
            { v: o.closure_residual_chirps2_mm, c: css('--gap'), name: 'unaccounted for', id: 'gap' }
        ];
        const x = 52, w = 84, top = 28, bottom = 402, H = bottom - top, k = H / P;
        const defs = svgEl('defs');
        const pat = svgEl('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
        pat.append(svgEl('rect', { width: 8, height: 8, fill: css('--gap') }), svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 3 }));
        defs.append(pat); svg.append(defs);
        // scale
        for (let t = 0; t <= P; t += 250) {
            const y = bottom - t * k;
            svg.append(svgEl('line', { x1: x - 8, x2: x, y1: y, y2: y, stroke: css('--ink-3'), 'stroke-width': 1 }));
            svg.append(svgEl('text', { x: x - 12, y: y + 4, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, fill: css('--ink-3') }, fmtInt(t)));
        }
        svg.append(svgEl('text', { x: x - 12, y: top - 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, fill: css('--ink-3') }, 'mm'));
        // water
        let y0 = bottom;
        const mids = [];
        parts.forEach(p => {
            const h = p.v * k, y = y0 - h;
            svg.append(svgEl('rect', { class: 'seg-rect', x: x + 3, y, width: w - 6, height: h, fill: p.id === 'gap' ? 'url(#hatch)' : p.c }));
            mids.push({ ...p, y: y + h / 2, h });
            y0 = y;
        });
        // glass
        svg.append(svgEl('path', { d: `M${x} ${top - 6} V${bottom - 10} Q${x} ${bottom} ${x + 10} ${bottom} H${x + w - 10} Q${x + w} ${bottom} ${x + w} ${bottom - 10} V${top - 6}`, fill: 'none', stroke: css('--ink'), 'stroke-width': 2.2 }));
        svg.append(svgEl('line', { x1: x - 6, x2: x + w + 6, y1: top - 6, y2: top - 6, stroke: css('--ink'), 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
        // labels, kept apart
        const gapMin = 40; mids.sort((a, b) => b.y - a.y);
        for (let i = 1; i < mids.length; i++) if (mids[i - 1].y - mids[i].y < gapMin) mids[i].ly = (mids[i - 1].ly ?? mids[i - 1].y) - gapMin;
        mids.forEach(m => {
            const ly = m.ly ?? m.y, g = svgEl('g', { class: 'lbl' });
            g.append(svgEl('path', { d: `M${x + w + 4} ${m.y} H${x + w + 14} L${x + w + 22} ${ly} H${x + w + 28}`, fill: 'none', stroke: css('--ink-3'), 'stroke-width': 1 }));
            g.append(svgEl('text', { x: x + w + 32, y: ly - 1, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 17, 'font-weight': 500, fill: m.id === 'gap' ? css('--gap') : css('--ink') }, `${fmtInt(m.v)} mm`));
            g.append(svgEl('text', { x: x + w + 32, y: ly + 16, 'font-family': 'IBM Plex Sans, sans-serif', 'font-size': 13, fill: css('--ink-2') }, `${m.name} · ${fmtInt(100 * m.v / P)}%`));
            svg.append(g);
        });
        requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('filled')));
    }

    function drawMiniYears() {
        const el = $('#mini-years'), rs = rowsOf('upper_oueme'), vals = rs.map(r => r.closure_residual_chirps2_mm), max = Math.max(...vals);
        el.innerHTML = rs.map(r => `<div style="height:${Math.max(2, 100 * r.closure_residual_chirps2_mm / max)}%" title="${r.year}: ${fmtInt(r.closure_residual_chirps2_mm)} mm"><span>${fmtInt(r.closure_residual_chirps2_mm)}</span></div>`).join('');
        el.setAttribute('aria-label', `Unexplained gap each year: ${rs.map(r => `${r.year} ${fmtInt(r.closure_residual_chirps2_mm)} mm`).join(', ')}`);
    }

    // ---------- maps ----------
    function hex(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function colorFor(v, meta) {
        if (!isNum(v)) return null;
        const t = Math.max(0, Math.min(1, (v - meta.vmin) / (meta.vmax - meta.vmin))), s = meta.stops;
        const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i, a = hex(s[i]), b = hex(s[i + 1]);
        return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * f)).join(',')})`;
    }
    const layerKey = (layer, product) => layer === 'et' ? 'et' : `${layer}_${product}`;
    const annualCol = (layer, product) => layer === 'et' ? 'et_wapor_mm' : layer === 'rain' ? `p_${product}_mm` : `surplus_${product}_mm`;
    const esri = (path, max = 16) => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: max, attribution: 'Basemap © Esri' });
    function dark() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }

    function createGridMap(el, opts) {
        const map = L.map(el, {
            zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25, boxZoom: false,
            dragging: opts.interactive || !coarse, touchZoom: opts.interactive, doubleClickZoom: opts.interactive, keyboard: opts.interactive
        });
        if (opts.interactive) L.control.zoom({ position: 'topright' }).addTo(map);
        map.setView([8.6, 2.9], 7);
        map.createPane('cells').style.zIndex = 380;
        const renderer = L.canvas({ pane: 'cells', padding: 0.4 });
        let baseLayer = null, baseKind = opts.basemap || 'terrain';
        const outline = L.geoJSON(GEO, { interactive: false, style: { color: css('--ink'), weight: 1.8, fill: false } }).addTo(map);
        const labels = L.layerGroup().addTo(map);
        const centers = {};
        outline.eachLayer(l => { centers[l.feature.properties.basin_id] = l.getBounds().getCenter(); });
        const rects = {};
        BIDS.forEach(b => {
            const g = D.grid[b], c = g.cell_deg;
            rects[b] = g.cells.map(([s, w], i) => {
                const r = L.rectangle([[s, w], [s + c, w + c]], { renderer, weight: 0.5, fillOpacity: 0.92, interactive: !!opts.interactive });
                if (opts.interactive) {
                    r.bindTooltip('', { sticky: true, className: 'tip', direction: 'top', offset: [0, -8] });
                    r.on('mouseover', () => r.setStyle({ weight: 2, color: css('--ink') }));
                    r.on('mouseout', () => r.setStyle({ weight: 0.5, color: r.options.fillColor }));
                    r.on('click', () => opts.onSelect && opts.onSelect(b));
                }
                return r.addTo(map);
            });
        });
        const gz = D.gauge;
        const gauge = L.marker([gz.lat, gz.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'gauge-pin', iconSize: [0, 0], html: '<div></div><span>Bétérou gauge</span>' }) }).addTo(map);
        const api = {
            map,
            setBase(kind) {
                baseKind = kind || baseKind;
                if (baseLayer) map.removeLayer(baseLayer);
                const dk = dark();
                baseLayer = baseKind === 'satellite' ? L.layerGroup([esri('World_Imagery', 17), esri('Reference/World_Boundaries_and_Places', 17)])
                    : (baseKind === 'terrain' && !dk) ? L.layerGroup([esri('World_Terrain_Base', 13), esri('Canvas/World_Light_Gray_Reference')])
                    : L.layerGroup([esri(dk ? 'Canvas/World_Dark_Gray_Base' : 'Canvas/World_Light_Gray_Base'), esri(dk ? 'Canvas/World_Dark_Gray_Reference' : 'Canvas/World_Light_Gray_Reference')]);
                baseLayer.addTo(map);
            },
            paint(st) {
                const none = st.layer === 'none', meta = none ? null : D.layers[st.layer], key = none ? null : layerKey(st.layer, st.product);
                BIDS.forEach(b => {
                    const vals = none ? null : D.grid[b].values[key][st.period];
                    rects[b].forEach((r, i) => {
                        const fillColor = none ? css('--accent') : (colorFor(vals[i], meta) || css('--paper-2'));
                        const dim = st.zone !== 'ALL' && st.zone !== b;
                        r.setStyle({ fillColor, color: fillColor, fillOpacity: none ? 0 : (dim ? 0.45 : 0.92), opacity: none ? 0 : (dim ? 0.45 : 0.92) });
                        if (opts.interactive && !none) r.setTooltipContent(`<strong>${esc(meta.short)}: ${fmtInt(vals[i])} mm</strong><br>${esc(BASIN[b].short)} · one 5 km cell · ${st.period === 'mean' ? '2018–2024 average' : st.period}${st.layer !== 'et' ? ` · ${PROD[st.product]}` : ''}`);
                    });
                });
                outline.setStyle(f => ({ color: css('--ink'), weight: st.zone === f.properties.basin_id ? 3.2 : 1.6, fill: none, fillColor: css('--accent'), fillOpacity: 0.16 }));
                labels.clearLayers();
                BIDS.forEach(b => {
                    const r = rec(b, st.period);
                    const sub = none ? `${BASIN[b].country} · ${fmtInt(area(b))} km²` : `${fmtInt(r[annualCol(st.layer, st.product)])} mm · catchment average`;
                    labels.addLayer(L.marker(centers[b], { interactive: false, keyboard: false, icon: L.divIcon({ className: `basin-label ${st.zone === b ? 'is-on' : ''}`, iconSize: [0, 0], html: `<div>${esc(BASIN[b].short)}<span>${esc(sub)}</span></div>` }) }));
                });
                const pin = gauge.getElement(); if (pin) pin.classList.toggle('pulse', !!st.gauge && !reduced);
            },
            fit(zone, animate, pad) {
                map.invalidateSize();
                let bounds = null;
                outline.eachLayer(l => { if (zone === 'ALL' || l.feature.properties.basin_id === zone) bounds = bounds ? bounds.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast()); });
                const o = Object.assign({ paddingTopLeft: [40, 56], paddingBottomRight: [40, 40] }, pad || {}, zone === 'ALL' ? {} : { maxZoom: 9 });
                if (animate && !reduced) map.flyToBounds(bounds, Object.assign({ duration: 0.9 }, o)); else map.fitBounds(bounds, Object.assign({ animate: false }, o));
            }
        };
        api.setBase(baseKind);
        return api;
    }

    function setLegend(prefix, layer, period, product) {
        const meta = D.layers[layer];
        $(`#${prefix}-title`).textContent = `${meta.label}, mm a year · ${period === 'mean' ? '2018–2024 average' : period}`;
        $(`#${prefix}-source`).textContent = layer === 'et' ? meta.source : `${PROD[product]}${layer === 'surplus' ? ' rainfall − WaPOR v3 evapotranspiration' : ''} · same colours every year`;
        $(`#${prefix}-ramp`).style.background = `linear-gradient(90deg, ${meta.stops.join(', ')})`;
        $(`#${prefix}-min`).textContent = `≤ ${fmtInt(meta.vmin)}`;
        $(`#${prefix}-mid`).textContent = fmtInt((meta.vmin + meta.vmax) / 2);
        $(`#${prefix}-max`).textContent = `≥ ${fmtInt(meta.vmax)}`;
    }

    // ---------- story ----------
    const STEPS = {
        place: { layer: 'none', zone: 'ALL', chip: '01 · The place' },
        shortcut: { layer: 'rain', zone: 'ALL', chip: '02 · Rainfall' },
        sky: { layer: 'et', zone: 'ALL', chip: '03 · Back to the sky' },
        left: { layer: 'surplus', zone: 'ALL', chip: '04 · What’s left' },
        river: { layer: 'surplus', zone: 'upper_oueme', gauge: true, chip: '05 · The river gauge' },
        gap: { layer: 'surplus', zone: 'upper_oueme', gauge: true, chip: '06 · The gap' }
    };
    let story = null, storyStep = 'place';
    function storyPad() { const lg = $('#story-legend'); const h = lg.hidden ? 0 : lg.offsetHeight + 16; return { paddingTopLeft: [36, 64], paddingBottomRight: [36, h + 28] }; }
    function applyStep(name, animate = true) {
        storyStep = name;
        const st = STEPS[name];
        $$('.step').forEach(s => s.classList.toggle('is-active', s.dataset.step === name));
        $('#story-chip').textContent = st.chip;
        $('#story-legend').hidden = st.layer === 'none';
        if (st.layer !== 'none') setLegend('sl', st.layer, 'mean', 'chirps2');
        story.paint({ layer: st.layer, zone: st.zone, period: 'mean', product: 'chirps2', gauge: st.gauge });
        story.fit(st.zone, animate, storyPad());
    }
    function initStory() {
        story = createGridMap('story-map', { interactive: false, basemap: 'terrain' });
        applyStep('place', false);
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting && e.target.dataset.step !== storyStep) applyStep(e.target.dataset.step); });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
        $$('.step').forEach(s => io.observe(s));
        new ResizeObserver(() => { story.map.invalidateSize(); story.fit(STEPS[storyStep].zone, false, storyPad()); }).observe($('.map-frame'));
    }

    // ---------- 07: could the ground hide it? ----------
    function drawSection() {
        const c = clo()[S.product], cum = c.cumulative_residual_mm, rise = cum / (S.sy / 100 * 1000);
        $('#sy-out').textContent = `${fmt(S.sy, 1)}%`;
        $('#sy').setAttribute('aria-valuetext', `${fmt(S.sy, 1)} percent`);
        $('#rise-out').textContent = fmtInt(rise);
        $('#storeys-out').textContent = `Roughly the height of a ${fmtInt(rise / 3)}-storey building.`;
        const svg = $('#section'); svg.innerHTML = '';
        const dk = dark(), W = 680, ground = 168, pxm = 2.0, y = m => ground + m * pxm;
        const col = dk ? { sky: '#1c1914', soil: '#7a4129', sap: '#5b4d35', fis: '#3f3b35', rock: '#26231f', ink: '#f1ebdf', ink2: '#cfc5b4', crack: '#625c53', well: '#14120e' }
                       : { sky: '#ebe3d2', soil: '#d49a74', sap: '#e8d3a8', fis: '#cbc3b4', rock: '#6f685d', ink: '#1e1a15', ink2: '#4b443a', crack: '#a39a8a', well: '#fffcf5' };
        const T = (x, yy, t, o = {}) => svgEl('text', Object.assign({ x, y: yy, 'font-family': 'IBM Plex Sans, sans-serif', 'font-size': 15, fill: col.ink }, o), t);
        svg.append(svgEl('rect', { x: 0, y: 0, width: W, height: ground, fill: col.sky }));
        [[0, 5, col.soil], [5, 45, col.sap], [45, 100, col.fis], [100, 130, col.rock]].forEach(([a, b, f]) => svg.append(svgEl('rect', { x: 0, y: y(a), width: W, height: (b - a) * pxm, fill: f })));
        for (let i = 0; i < 8; i++) { const x0 = 120 + i * 62; svg.append(svgEl('path', { d: `M${x0} ${y(56 + (i % 3) * 10)} l12 9 l-5 11 l11 8`, fill: 'none', stroke: col.crack, 'stroke-width': 1.5 })); }
        svg.append(svgEl('line', { x1: 0, x2: W, y1: ground, y2: ground, stroke: col.ink, 'stroke-width': 2 }));
        svg.append(T(56, y(34), 'Saprolite: weathered rock that stores the water', { 'font-weight': 600 }));
        svg.append(T(56, y(80), 'Fissured layer: lets water move'));
        svg.append(T(56, y(112) + 4, 'Fresh bedrock: little or no water', { fill: dk ? col.ink2 : '#f4efe4' }));
        [0, 25, 50, 75, 100].forEach(m => {
            svg.append(svgEl('line', { x1: 0, x2: 8, y1: y(m), y2: y(m), stroke: col.ink, 'stroke-width': 1.2 }));
            svg.append(T(11, y(m) + 4, `${m}`, { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, fill: m === 100 && !dk ? '#f4efe4' : col.ink2 }));
        });
        svg.append(T(11, y(100) + 18, 'm deep', { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, fill: dk ? col.ink2 : '#f4efe4' }));
        // a well and its hut
        const wx = 600;
        svg.append(svgEl('rect', { x: wx, y: ground, width: 12, height: 30 * pxm, fill: col.well, stroke: col.ink, 'stroke-width': 1.5 }));
        svg.append(svgEl('path', { d: `M${wx - 16} ${ground} v-20 h44 v20 M${wx - 22} ${ground - 20} l28 -16 l28 16`, fill: col.well, stroke: col.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
        svg.append(T(wx - 6, ground + 30 * pxm + 18, 'a well', { 'font-size': 13, fill: col.ink2 }));
        // today's water table (illustrative) and the level needed to hold the gap
        const river = css('--river'), wt = y(12), need = wt - rise * pxm, top = Math.max(8, need), off = need < 8;
        svg.append(svgEl('rect', { x: 150, y: top, width: 400, height: wt - top, fill: river, opacity: dk ? 0.28 : 0.2 }));
        svg.append(svgEl('line', { x1: 0, x2: W, y1: wt, y2: wt, stroke: river, 'stroke-width': 2.5, 'stroke-dasharray': '9 6' }));
        svg.append(T(56, wt + 20, 'water table today (illustrative)', { 'font-size': 13, 'font-weight': 600, fill: col.ink }));
        if (!off) svg.append(svgEl('line', { x1: 150, x2: 550, y1: need, y2: need, stroke: river, 'stroke-width': 2.5 }));
        svg.append(svgEl('path', { d: `M350 ${wt - 4} V${top + 14}`, stroke: river, 'stroke-width': 3, fill: 'none' }));
        svg.append(svgEl('path', { d: `M340 ${top + 20} L350 ${top + 6} L360 ${top + 20}`, stroke: river, 'stroke-width': 3, fill: 'none', 'stroke-linejoin': 'round' }));
        const ly = Math.min(ground - 46, Math.max(30, top + 26));
        svg.append(T(368, ly, `+${fmtInt(rise)} m`, { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 24, 'font-weight': 500 }));
        svg.append(T(368, ly + 20, off ? 'above today\u2019s water table: far beyond this chart' : 'above today\u2019s water table', { 'font-size': 13.5, fill: col.ink2 }));
        svg.append(T(W - 10, 22, 'ground level is the black line', { 'font-size': 12, fill: col.ink2, 'text-anchor': 'end' }));
        svg.setAttribute('aria-label', `Illustrative cross-section: storing the ${fmtInt(cum)} mm gap with ${fmt(S.sy, 1)}% specific yield would need the water table to rise ${fmtInt(rise)} metres.`);
    }

    // ---------- 08: products ----------
    function renderProducts() {
        const o = rec('upper_oueme'), c = clo();
        $('#prod-seg').innerHTML = PRODS.map(p => `<button type="button" data-prod="${p}" aria-pressed="${S.product === p}"><span class="dot" style="background:${pcol(p)}"></span>${PROD[p]}</button>`).join('');
        const maxRain = Math.max(...PRODS.map(p => o[`p_${p}_mm`])), maxGap = Math.max(...PRODS.map(p => c[p].mean_closure_residual_mm));
        $('#prod-table tbody').innerHTML = PRODS.map(p => `<tr data-prod="${p}" aria-selected="${S.product === p}" tabindex="0">
            <td><span class="prod-name"><span class="dot" style="background:${pcol(p)}"></span>${PROD[p]}</span></td>
            <td class="bar-cell"><div class="hbar"><i style="width:${70 * o[`p_${p}_mm`] / maxRain}%;background:${pcol(p)}"></i><b>${fmtInt(o[`p_${p}_mm`])}</b></div></td>
            <td class="bar-cell"><div class="hbar"><i style="width:${70 * c[p].mean_closure_residual_mm / maxGap}%;background:var(--gap)"></i><b>${fmtInt(c[p].mean_closure_residual_mm)}</b></div></td></tr>`).join('');
    }
    function setProduct(p) {
        if (!PROD[p]) return;
        S.product = p;
        fill(); renderProducts(); drawSection(); renderScale(); resetFix(); writeQuery();
    }

    // ---------- 09: scale ----------
    function renderScale() {
        const c = clo(), rf = D.summary.published_recharge_fraction, X = 25, pos = v => `${Math.min(100, 100 * v / X)}%`;
        const [ka, kb] = rf.kamagate2007, ko = rf.kotchoni2019[0];
        const dots = PRODS.map(p => `<span class="cmp-dot ${p === S.product ? 'is-on' : ''}" style="left:${pos(c[p].residual_pct_of_rainfall)};background:${pcol(p)}" title="${PROD[p]}: ${fmt(c[p].residual_pct_of_rainfall, 1)}% of rainfall"></span>`).join('');
        $('#cmp').innerHTML =
            `<div class="cmp-row"><div class="cmp-name">My unexplained gap<span>Upper Ouémé, 2018–2024</span></div><div class="cmp-track">${dots}</div></div>` +
            `<div class="cmp-row"><div class="cmp-name">Recharge from wells<span>Kamagaté et al., 2007 · Donga</span></div><div class="cmp-track"><span class="cmp-range" style="left:${pos(100 * ka)};width:${100 * (kb - ka) * 100 / X}%" title="${fmtInt(100 * ka)}–${fmtInt(100 * kb)}% of rainfall"></span></div></div>` +
            `<div class="cmp-row"><div class="cmp-name">Recharge from wells<span>Kotchoni et al., 2019 · Benin</span></div><div class="cmp-track"><span class="cmp-tick" style="left:${pos(100 * ko)}" title="about ${fmtInt(100 * ko)}% of rainfall"></span></div></div>` +
            `<div class="cmp-axis"><div></div><div class="cmp-ticks">${[0, 5, 10, 15, 20, 25].map(t => `<span style="left:${pos(t)}">${t}%</span>`).join('')}</div></div>` +
            `<p class="fine" style="margin:6px 0 0">Share of yearly rainfall. Dots: ${PRODS.map(p => `<span style="white-space:nowrap"><span class="dot" style="background:${pcol(p)};margin-right:5px;vertical-align:-1px"></span>${PROD[p]} ${fmt(c[p].residual_pct_of_rainfall, 1)}%</span>`).join(' · ')}</p>`;
    }

    // ---------- 10: close the gap ----------
    const FX = { et: 0, rain: 0, ratio: null };
    function resetFix() { FX.et = 0; FX.rain = 0; FX.ratio = ratioObs(); syncFix(); }
    function syncFix() {
        $('#fx-et').value = FX.et; $('#fx-rain').value = FX.rain; $('#fx-ratio').value = FX.ratio;
        renderFix();
    }
    function renderFix() {
        const o = rec('upper_oueme'), k = S.product;
        const P = o[`p_${k}_mm`] * (1 + FX.rain / 100), ET = o.et_wapor_mm * (1 + FX.et / 100), Q = FX.ratio * P, gap = P - ET - Q;
        $('#fx-et-out').textContent = `${signed(FX.et)}%`;
        $('#fx-rain-out').textContent = `${signed(FX.rain)}%`;
        $('#fx-ratio-out').textContent = fmt(FX.ratio, 3);
        $('#fx-et').setAttribute('aria-valuetext', `${signed(FX.et)} percent`);
        $('#fx-rain').setAttribute('aria-valuetext', `${signed(FX.rain)} percent`);
        $('#fx-gap').textContent = fmtInt(Math.abs(gap) < 0.5 ? 0 : gap);
        const closed = Math.abs(gap) <= 5;
        $('#fx-status').textContent = closed ? 'left over: the books balance' : gap > 0 ? 'still unaccounted for each year' : 'too little water: you went past zero';
        $('#fx-verdict').hidden = !closed;
        if (closed) {
            const what = [];
            if (Math.abs(FX.et) >= 0.1) what.push(`evapotranspiration ${signed(FX.et)}%`);
            if (Math.abs(FX.rain) >= 0.1) what.push(`rainfall ${signed(FX.rain)}%`);
            if (Math.abs(FX.ratio - ratioObs()) >= 0.0005) what.push(`a river share of ${fmt(FX.ratio, 3)}`);
            $('#fx-verdict-text').textContent = `Balanced with ${what.join(', ') || 'no change'}. Each fix is plausible, so the data alone cannot say which one is real.`;
        }
        const tot = Math.max(P, ET + Q), parts = [['b-air', 'Back to the sky', ET], ['b-river', 'River', Q]].concat(gap > 0 ? [['b-gap', 'Unaccounted for', gap]] : []);
        $('#fx-bar').innerHTML = parts.map(([c, n, v]) => { const w = 100 * v / tot; return `<div class="${c}" style="width:${w}%" title="${n}: ${fmtInt(v)} mm">${w > 9 ? fmtInt(v) : ''}</div>`; }).join('');
        $('#fx-keys').innerHTML = [['var(--air)', 'Back to the sky', ET], ['#1f66c2', 'Carried by the river', Q], ['var(--gap)', gap >= -0.5 ? 'Unaccounted for' : 'Short by', Math.abs(gap) < 0.5 ? 0 : Math.abs(gap)], ['transparent', 'Rain (adjusted)', P]]
            .map(([c, n, v]) => `<div><i style="background:${c};${c === 'transparent' ? 'border:1px solid var(--line-2)' : ''}"></i><span>${n}</span><b>${fmtInt(v)} mm</b></div>`).join('');
    }
    function initFix() {
        $('#fx-et').addEventListener('input', e => { FX.et = Number(e.target.value); renderFix(); });
        $('#fx-rain').addEventListener('input', e => { FX.rain = Number(e.target.value); renderFix(); });
        $('#fx-ratio').addEventListener('input', e => { FX.ratio = Number(e.target.value); renderFix(); });
        $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
            const c = clo()[S.product];
            resetFix();
            if (b.dataset.preset === 'et') FX.et = Math.round(c.et_increase_needed_pct * 10) / 10;
            if (b.dataset.preset === 'rain') FX.rain = -Math.round(c.rain_decrease_needed_pct * 10) / 10;
            if (b.dataset.preset === 'ratio') FX.ratio = Math.round(c.runoff_ratio_needed * 1000) / 1000;
            syncFix();
        }));
    }

    // ---------- 11: Upper Ogun ----------
    function renderOgun() {
        const g = rec('upper_ogun'), P = g.p_chirps2_mm, ET = g.et_wapor_mm, L0 = g.surplus_chirps2_mm;
        $('#og-bar').innerHTML = `<div class="b-air" style="width:${100 * ET / P}%">${fmtInt(100 * ET / P)}%</div><div class="b-left" style="width:${100 * L0 / P}%">${fmtInt(100 * L0 / P)}%</div>`;
        $('#og-keys').innerHTML = [['var(--air)', 'Back to the sky', ET], ['color-mix(in srgb, var(--river) 45%, var(--paper-2))', 'Left over, unchecked', L0], ['transparent', 'Rain', P]]
            .map(([c, n, v]) => `<div><i style="background:${c};${c === 'transparent' ? 'border:1px solid var(--line-2)' : ''}"></i><span>${n}</span><b>${fmtInt(v)} mm</b></div>`).join('');
    }

    // ---------- explore ----------
    let ex = null, playTimer = null;
    const EXL = { surplus: 'Rain left after ET', rain: 'Rainfall', et: 'Evapotranspiration' };
    function renderExploreControls() {
        const E = S.ex;
        $('#ex-zone').innerHTML = [['ALL', 'Both'], ['upper_oueme', 'Upper Ouémé'], ['upper_ogun', 'Upper Ogun']].map(([v, t]) => `<button type="button" data-zone="${v}" aria-pressed="${E.zone === v}">${t}</button>`).join('');
        $('#ex-layer').innerHTML = Object.entries(EXL).map(([v, t]) => `<button type="button" data-layer="${v}" aria-pressed="${E.layer === v}">${t}</button>`).join('');
        $('#ex-prod').innerHTML = PRODS.map(p => `<button type="button" data-xprod="${p}" aria-pressed="${E.product === p}" ${E.layer === 'et' ? 'disabled title="Evapotranspiration does not depend on the rainfall product"' : ''}><span class="dot" style="background:${pcol(p)}"></span>${PROD[p]}</button>`).join('');
        $('#ex-year').innerHTML = [['mean', '2018–2024']].concat(YEARS.map(y => [y, y])).map(([v, t]) => `<button type="button" data-year="${v}" aria-pressed="${E.period === v}">${t}</button>`).join('');
        $('#ex-play').innerHTML = playTimer
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
        $('#ex-play').setAttribute('aria-label', playTimer ? 'Pause' : 'Play through the years');
    }
    function renderSide() {
        const E = S.ex, k = E.product, list = E.zone === 'ALL' ? BIDS : [E.zone];
        const when = E.period === 'mean' ? '2018–2024 average' : E.period;
        $('#sd-kicker').textContent = `${when} · ${PROD[k]}`;
        $('#sd-title').textContent = E.zone === 'ALL' ? 'Both catchments' : BASIN[E.zone].full;
        const blocks = list.map(b => {
            const r = rec(b, E.period), P = r[`p_${k}_mm`], ET = r.et_wapor_mm, oue = b === 'upper_oueme';
            const Q = r[`q_expected_${k}_mm`], gap = r[`closure_residual_${k}_mm`], left = r[`surplus_${k}_mm`];
            const segs = oue && isNum(Q) ? [['b-air', ET], ['b-river', Q]].concat(gap > 0 ? [['b-gap', gap]] : []) : [['b-air', ET], ['b-left', left]];
            const tot = Math.max(P, segs.reduce((a, s) => a + s[1], 0));
            const cls = r.rain_class_chirps2 || (E.period === 'mean' ? `${D.summary.basins[b].rain_class_counts_chirps2.wet} wet years` : '—');
            return `${list.length > 1 ? `<div class="kicker" style="margin-top:14px;color:var(--ink-2)">${esc(BASIN[b].short)}</div>` : ''}
                <div class="budget-bar">${segs.map(([c, v]) => `<div class="${c}" style="width:${100 * v / tot}%">${100 * v / tot > 12 ? fmtInt(v) : ''}</div>`).join('')}</div>
                <dl class="kv"><dt>Rain</dt><dd>${fmtInt(P)} mm</dd><dt>Back to the sky</dt><dd>${fmtInt(ET)} mm</dd><dt>Left after ET</dt><dd>${fmtInt(left)} mm</dd>
                ${oue ? `<dt>River (expected)</dt><dd>${fmtInt(Q)} mm</dd><dt>Unaccounted for</dt><dd class="hl">${fmtInt(gap)} mm</dd>` : '<dt>River</dt><dd>no records</dd>'}
                <dt>Wet or dry?</dt><dd>${esc(cls)}</dd></dl>`;
        }).join('');
        $('#sd-body').innerHTML = blocks;
        $('#sd-note').textContent = list.includes('upper_ogun') ? 'No river-flow records were found for the Upper Ogun, so its left-over water cannot be checked.' : 'Expected river flow uses the share the Ouémé carried in 1988–2010.';
    }
    function renderTable() {
        const E = S.ex, k = E.product, list = E.zone === 'ALL' ? BIDS : [E.zone];
        const head = `<thead><tr>${list.length > 1 ? '<th>Catchment</th>' : ''}<th>Year</th><th>Wet / dry</th><th>Rain</th><th>Back to sky</th><th>Left</th><th>River</th><th>Gap</th></tr></thead>`;
        const row = (b, r, avg) => {
            const on = (avg && E.period === 'mean') || (!avg && String(r.year) === E.period);
            const cls = r.rain_class_chirps2;
            return `<tr class="${avg ? 'avg' : ''} ${on ? 'is-on' : ''}" data-year="${avg ? 'mean' : r.year}" tabindex="0">${list.length > 1 ? `<td>${esc(BASIN[b].short)}</td>` : ''}<td>${avg ? 'Average' : r.year}</td><td>${cls ? `<span class="chip ${cls}">${cls}</span>` : '—'}</td><td>${fmtInt(r[`p_${k}_mm`])}</td><td>${fmtInt(r.et_wapor_mm)}</td><td>${fmtInt(r[`surplus_${k}_mm`])}</td><td>${isNum(r[`q_expected_${k}_mm`]) ? fmtInt(r[`q_expected_${k}_mm`]) : '—'}</td><td>${isNum(r[`closure_residual_${k}_mm`]) ? fmtInt(r[`closure_residual_${k}_mm`]) : '—'}</td></tr>`;
        };
        $('#ex-table').innerHTML = head + '<tbody>' + list.map(b => rowsOf(b).map(r => row(b, r, false)).join('') + row(b, Object.assign(rec(b), { rain_class_chirps2: null }), true)).join('') + '</tbody>';
        $$('#ex-table tbody tr').forEach(tr => { const go = () => setEx({ period: tr.dataset.year }); tr.addEventListener('click', go); tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
    }
    function exPad() { const lg = $('#ex-legend'); return { paddingTopLeft: [40, 40], paddingBottomRight: [40, lg.offsetHeight + 30] }; }
    function setEx(change, refit) {
        Object.assign(S.ex, change);
        renderExploreControls();
        setLegend('el', S.ex.layer, S.ex.period, S.ex.product);
        ex.paint({ layer: S.ex.layer, zone: S.ex.zone, period: S.ex.period, product: S.ex.product });
        if (refit) ex.fit(S.ex.zone, true, exPad());
        renderSide(); renderTable(); writeQuery();
    }
    function stopPlay() { if (playTimer) clearInterval(playTimer); playTimer = null; renderExploreControls(); }
    function initExplore() {
        ex = createGridMap('explore-map', { interactive: true, basemap: 'terrain', onSelect: b => setEx({ zone: b }) });
        $('#ex-zone').addEventListener('click', e => { const b = e.target.closest('[data-zone]'); if (b) setEx({ zone: b.dataset.zone }, true); });
        $('#ex-layer').addEventListener('click', e => { const b = e.target.closest('[data-layer]'); if (b) setEx({ layer: b.dataset.layer }); });
        $('#ex-prod').addEventListener('click', e => { const b = e.target.closest('[data-xprod]'); if (b && !b.disabled) setEx({ product: b.dataset.xprod }); });
        $('#ex-year').addEventListener('click', e => { const b = e.target.closest('[data-year]'); if (b) { stopPlay(); setEx({ period: b.dataset.year }); } });
        $('#ex-play').addEventListener('click', () => {
            if (playTimer) return stopPlay();
            let i = S.ex.period === 'mean' ? -1 : YEARS.indexOf(S.ex.period);
            const step = () => { i += 1; if (i >= YEARS.length) return stopPlay(); setEx({ period: YEARS[i] }); };
            playTimer = setInterval(step, 1000); step();
        });
        $('#ex-base').addEventListener('change', e => ex.setBase(e.target.value));
        setEx({}, false);
        ex.fit(S.ex.zone, false, exPad());
        new ResizeObserver(() => { ex.map.invalidateSize(); }).observe($('.explore-map'));
    }

    // ---------- query string (shareable explore state) ----------
    function writeQuery() {
        const p = new URLSearchParams();
        if (S.ex.zone !== 'ALL') p.set('zone', S.ex.zone);
        if (S.ex.layer !== 'surplus') p.set('layer', S.ex.layer);
        if (S.ex.period !== 'mean') p.set('year', S.ex.period);
        if (S.ex.product !== 'chirps2') p.set('rain', S.ex.product);
        if (S.product !== 'chirps2') p.set('story_rain', S.product);
        const q = p.toString();
        try { history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`); } catch (e) {}
    }
    function readQuery() {
        const p = new URLSearchParams(location.search);
        if (BIDS.includes(p.get('zone'))) S.ex.zone = p.get('zone');
        if (EXL[p.get('layer')]) S.ex.layer = p.get('layer');
        if (YEARS.includes(p.get('year'))) S.ex.period = p.get('year');
        if (PROD[p.get('rain')]) S.ex.product = p.get('rain');
        if (PROD[p.get('story_rain')]) S.product = p.get('story_rain');
    }

    // ---------- chrome: theme, share, dialogs, progress, reading time ----------
    function paintThemeButton() {
        $('#btn-theme').innerHTML = dark()
            ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
            : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
        $('#btn-theme').setAttribute('aria-label', dark() ? 'Switch to light theme' : 'Switch to dark theme');
    }
    function repaint() {
        paintThemeButton(); drawGauge(); drawSection(); renderProducts(); renderScale(); renderFix(); renderOgun();
        if (story) { story.setBase(); applyStep(storyStep, false); }
        if (ex) { ex.setBase(); setEx({}); }
    }
    function initChrome() {
        paintThemeButton();
        $('#btn-theme').addEventListener('click', () => {
            const next = dark() ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('mm_theme', next); } catch (e) {}
            repaint();
        });
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.getAttribute('data-theme')) repaint(); });
        $('#btn-share').addEventListener('click', () => {
            const done = () => snack('Link copied');
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, () => window.prompt('Copy this link:', location.href));
            else window.prompt('Copy this link:', location.href);
        });
        document.addEventListener('click', e => {
            const o = e.target.closest('[data-open]'); if (o) { const d = document.getElementById(o.dataset.open); if (d && !d.open) d.showModal(); }
            const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close();
            if (e.target.tagName === 'DIALOG') e.target.close();
            const pr = e.target.closest('[data-prod]'); if (pr) setProduct(pr.dataset.prod);
        });
        $('#prod-table').addEventListener('keydown', e => { const tr = e.target.closest('tr[data-prod]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setProduct(tr.dataset.prod); } });
        const bar = $('#progress');
        const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.width = `${h > 0 ? 100 * scrollY / h : 0}%`; };
        addEventListener('scroll', onScroll, { passive: true }); onScroll();
        const words = ($('main').innerText || '').split(/\s+/).filter(Boolean).length;
        $('#read-time').textContent = Math.max(1, Math.round(words / 230));
        $('#sy').addEventListener('input', e => { S.sy = Number(e.target.value); drawSection(); });
    }
    function snack(msg) { const el = document.createElement('div'); el.className = 'snack'; el.setAttribute('role', 'status'); el.textContent = msg; document.body.append(el); setTimeout(() => el.remove(), 2200); }

    // ---------- start ----------
    Promise.all([
        fetch('data/app_data.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetch('data/basins.geojson').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    ]).then(([data, geo]) => {
        D = data; GEO = geo;
        readQuery();
        FX.ratio = ratioObs();
        fill();
        initChrome();
        animateLedger(); drawGauge(); drawMiniYears();
        renderProducts(); drawSection(); renderScale(); initFix(); syncFix(); renderOgun();
        initStory(); initExplore();
    }).catch(err => {
        console.error(err);
        const m = document.createElement('p');
        m.className = 'fine'; m.style.cssText = 'text-align:center;padding:12px';
        m.textContent = `The data could not be loaded (${err.message}). Please reload the page.`;
        document.querySelector('main').prepend(m);
    });
})();
