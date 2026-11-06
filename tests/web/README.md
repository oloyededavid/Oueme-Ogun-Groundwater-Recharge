# Browser checks for the web version

Two scripts drive the page in Chromium with Playwright. They are not run in CI; run them before publishing.

```bash
npm install playwright axe-core@4.10.2
```

```bash
python -m http.server 8767 --directory docs
```

```bash
node tests/web/behaviour.js
```

```bash
URL=http://127.0.0.1:8767/index.html node tests/web/features.js
```

```bash
AXE=node_modules/axe-core/axe.min.js node tests/web/accessibility.js
```

- `behaviour.js` checks that every control changes what it should, with expected values read from
  `outputs/summary.json`: product selectors, sliders, the single-term buttons, the explorer and its table,
  shareable links, the contents bar, the scroll-driven map, keyboard focus, and the phone layout.
- `features.js` checks catchment selection, the equation, the datasets drawer, the figure viewer and
  links, reactions (one per browser), view and reaction counts (live host only), reading progress and back to top.
- `accessibility.js` runs axe-core on desktop and phone and reports console errors, failed requests and
  horizontal overflow.

Set `URL` to check another address, for example the deployed site.
