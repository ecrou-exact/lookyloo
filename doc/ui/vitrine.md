# Vitrine web components

[Vitrine](https://github.com/ecrou-exact/vitrine) (MIT) provides framework-free
web components (`<vt-markdown>`, `<vt-openapi>`, `<vt-json>`…) that render and
edit content safely (sanitized Markdown, text-only insertion).

## Installation

Not committed (maintainer rule: no third-party file in the repository):
`tools/3rdparty.py` downloads the source at a pinned commit (`VITRINE_COMMIT`,
SHA-256 checked), builds it with **Node >= 20** and keeps the ES modules,
languages, syntax themes and `vitrine.css` in `static/vendor/vitrine/`
(git-ignored). Offline instances install it from an export: doc/ui/offline.md.

## Using a component on a page

1. Load `vendor/vitrine/vitrine.css` in `page_styles` (with `get_sri`).
2. A page module (`type="module"`, nonce, SRI) imports `js/vitrine_setup.js`
   — it defines `<vt-markdown>`, points vitrine at its files and follows the
   Lookyloo light / dark theme (`data-bs-theme`) — then the other components
   it needs, e.g. `js/api_reference.js`:

   ```js
   import './vitrine_setup.js';
   import '../vendor/vitrine/esm/vt-openapi.js';
   ```
3. Add the class `lk-vitrine` to the element: `css/components/vitrine.css`
   maps the `--lk-*` tokens on vitrine's `--vt-*` tokens.

Only `vitrine.css` has an SRI hash in `sri.txt`: the modules are imported by our
own modules (CSP `script-src-elem 'self'`), `tools/generate_sri.py` skips them.

## Where it is used

| Page | Component |
|---|---|
| Capture page: notes of the analyst (doc/ui/pages/tree.md) | `<vt-markdown>` (editor with preview, rendering) |
| API reference `/api` (doc/ui/pages/api.md) | `<vt-openapi>`, `<vt-http>` |
