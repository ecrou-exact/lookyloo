# AGENTS.md — Lookyloo

Guide for AI agents and contributors working on this repository. The `ui-redesign`
branch is dedicated to a full overhaul of the web interface; the last section
covers what matters for that work.

## What Lookyloo is

Lookyloo is a web forensics tool. You give it a URL; it drives a real headless
browser (Playwright, via **Lacus**), records everything (HAR, screenshot, HTML,
cookies, downloads, video, console logs, storage state), then builds a **tree of
the domains and URLs** that called each other (via **har2tree**). The tree is
displayed with D3.js and enriched by third-party modules (VirusTotal, MISP,
Phishtank, urlscan, Pandora, etc.).

- Python package: `lookyloo` (version in `pyproject.toml`, Python 3.10–3.14)
- Web: Flask + Jinja2 + Bootstrap 5 (`bootstrap-flask`) + jQuery + DataTables + D3
- REST API: flask-restx, self-documented with Swagger at `/doc`
- Storage: files on disk (`scraped/`, `archived_captures/`) + Valkey/Redis (cache,
  indexing) + optionally Kvrocks (full index)
- Official client: `pylookyloo`

## Repository layout

```
bin/                    Entry points (declared in pyproject [project.scripts])
  start.py / stop.py    Start/stop everything (backend DBs + all daemons + website)
  run_backend.py        Starts/stops the Valkey "cache" + "indexing" DBs (+ kvrocks)
  async_capture.py      Pulls queued captures, sends them to Lacus, stores results
  background_build_captures.py  Builds capture caches/trees from captured data
  background_indexer.py Indexes captures (hostnames, IPs, hashes, cookies, favicons…)
  background_processing.py  Periodic jobs (user agents list, etc.)
  archiver.py           Moves old captures to archived_captures/ (+ s3fs option)
  start_website.py      Runs gunicorn (10 workers) on website_listen_ip:port
  update.py             git pull + poetry install + config validation + 3rd party JS
  mastobot.py           Optional Mastodon bot
lookyloo/               Core library
  lookyloo.py           `Lookyloo` class: THE central API used by the website
                        (enqueue_capture, capture_cache, get_info, get_screenshot,
                        misp_export, trigger_modules, send_mail, …)
  capturecache.py       CaptureCache / tree pickling, loading, building
  indexing.py           `Indexing` class: all the Redis-based correlation indexes
  context.py            Known-content / legitimate resources
  comparator.py         Compare two captures
  helpers.py            Misc helpers (user agents, taxonomies, mimetypes, …)
  modules/              One file per 3rd-party integration (all subclass
                        abstractmodule.AbstractModule; configured in config/modules.json)
  default/              Generic plumbing: get_homedir(), get_config(),
                        get_socket_path(), AbstractManager (daemon base class)
website/web/
  __init__.py           Flask app: config, Talisman/CSP, auth, jinja globals,
                        ALL HTML routes (~3600 lines) + /tables/<name> JSON endpoints
  genericapi.py         flask-restx REST API (namespace mounted at /)
  helpers.py            Users/API keys, SRI loading, Lookyloo singleton
  default_csp.py        Content-Security-Policy (overridable with custom_csp.py)
  proxied.py            Reverse proxy middleware
  sri.txt               Generated SRI hashes for every file in static/, keyed by
                        path relative to static/ (e.g. "css/generic.css")
  templates/
    layouts/            Page skeletons (main.html: every page extends it)
    partials/           Pieces included in layouts/pages (top_navbar.html)
    macros/             Shared Jinja macros (macros.html)
    errors/             Error pages
    home/               Landing list of captures (index.html), search.html
    capture/            Submit forms: capture, simple_capture, submit_capture, bulk_captures
    tree/               Capture result: tree.html, tree_wait.html, hostname_popup.html,
                        prettify_text.html
      modals/           HTML fragments/pages loaded in the tree page modals (data-remote)
    investigate/        Pivot/detail pages: url, hostname, domain, tld, ip, body_hash,
                        cookie_name, hhh_details, favicon_details, identifier_details, …
    explore/            Global listings: cookies, hhhashes, favicons, ressources, categories
    admin/              Login-only pages (stats.html)
    custom_header.html, custom_footer.html   OPTIONAL instance hooks, stay at the root
  static/
    css/                Our stylesheets (+ optional instance css/overrides.css)
    js/                 Our scripts (+ optional instance js/overrides.js)
    vendor/             3rd-party libs, git-ignored, downloaded by tools/3rdparty.py
    images/brand/       Logos, favicon
    images/icons/       Tree / mimetype / status icons (also used by tree.js & get_icon)
    images/ui/          Misc UI images (arrows, loader, error screenshot placeholder)
    custom-favicon.ico  OPTIONAL instance hook, stays at the root
config/                 *.json.sample → copy to *.json (generic, modules, logging…)
  users/                Per-user config (admin.json.sample)
cache/, indexing/,      Valkey/Kvrocks working dirs + their .conf and run_*.sh
kvrocks_index/, full_index/
tools/                  Maintenance scripts (3rdparty.py, generate_sri.py,
                        validate_config_files.py, rebuild_caches.py, …)
tests/test_generic.py   Playwright end-to-end tests against a running instance
etc/                    nginx, systemd, logrotate samples for production
```

## How a capture flows

1. User submits `/capture` (web form, `capture.html` + `static/capture.js`) or
   `POST /submit` (API).
2. `Lookyloo.enqueue_capture()` validates settings (pydantic
   `LookylooCaptureSettings`) and pushes the capture to Lacus (local `LacusCore`
   or a remote `PyLacus`), with a priority depending on source/user.
3. `bin/async_capture.py` triggers the captures and, when done, writes the
   results into `scraped/<year>/<month>/<date>/<uuid>/`.
4. `bin/background_build_captures.py` builds the tree (har2tree) and caches it
   (pickle + Redis cache entry).
5. `bin/background_indexer.py` adds the capture to the correlation indexes.
6. The web page `/tree/<uuid>` (`tree.html` + `static/tree.js`) loads the tree
   JSON from the API (`GenericAPI_tree_dump`) and renders it with D3. While the
   capture is still processing, `tree_wait.html` is shown.

## Configuration

- `get_config('generic', 'key')` reads `config/generic.json`, falling back to the
  `.sample` file. Every key is documented in `_notes` inside the sample.
- `LOOKYLOO_HOME` must be set, usually through a `.env` file at the repo root:
  `LOOKYLOO_HOME='/abs/path/to/lookyloo'`.
- Useful keys for local dev: `website_listen_port` (5100), `users`
  (`{"admin": "password"}` enables login/admin pages), `index_everything`,
  `kvrocks_index`, `enable_categorization`, `enable_bookmark`,
  `enable_takedown_form`, `index_is_capture` (landing page = capture form).
- Valkey **8+** is required: `cache/run_redis.sh` looks for
  `../../valkey/src/valkey-server` (i.e. a valkey clone *next to* the lookyloo
  directory), then `../../redis/src/redis-server`, then `/usr/bin/redis-server`,
  and refuses v7.

## Running and checking

```bash
poetry install                 # deps
poetry run update --init       # playwright browsers, config validation, 3rd-party JS
poetry run start               # everything, website on http://127.0.0.1:5100
poetry run stop                # graceful stop
poetry run mypy .              # type checking (CI runs it, config in mypy.ini)
poetry install --with dev && poetry run python -m pytest tests   # needs a running instance
```

Logs: `logs/` (daemons) and `website/logs/` (gunicorn/Flask).

To iterate quickly on the website only (backend DBs + daemons already running
through `poetry run start`), you can stop the gunicorn website and run Flask
with reload instead:

```bash
cd website && DEBUG=1 poetry run flask --app web run --port 5100 --debug
```

## Web UI: what an agent must know

### Template map

All pages extend `templates/layouts/main.html` (loads Bootstrap CSS/JS, jQuery,
DataTables, json-viewer, `css/generic.css`, `js/generic.js`, `js/render_tables.js`,
`js/theme_toggle.js`, and optional `custom_header.html` / `custom_footer.html` /
`css/overrides.css` / `js/overrides.js`). Top-level pages include
`partials/top_navbar.html`.

Where to put new files (decided once, so files don't move again):
new page → the feature folder in `templates/`; new reusable piece → `partials/`;
new macro file → `macros/`; new layout → `layouts/`; CSS → `static/css/`
(design tokens go in `static/css/theme.css`); JS → `static/js/`; fonts →
`static/fonts/`; icons → `static/images/icons/`. Reference templates by their
path from `templates/` (`render_template('tree/tree.html')`) and static files by
their path from `static/` in both `url_for` and `get_sri`
(`url_for('static', filename='css/tree.css')` + `get_sri('static', 'css/tree.css')`).

| Area | Templates |
|------|-----------|
| Landing / list of captures | `home/index.html` (DataTable `#IndexTable`, server-side via `POST /tables/indexTable/`), `home/search.html` |
| New capture | `capture/capture.html` + `js/capture.js`, `capture/simple_capture.html` (takedown), `capture/submit_capture.html` (upload), `capture/bulk_captures.html` |
| Capture result | `tree/tree.html` (the big one: menus, modals, D3 tree) + `js/tree.js`, `js/tree_modals.js`, `css/tree.css`; `tree/tree_wait.html`; `tree/hostname_popup.html` + `js/hostnode_modals.js` |
| Capture side panels (loaded in modals) | everything in `tree/modals/` |
| Pivot / correlation pages | everything in `investigate/` |
| Global listings | everything in `explore/`; `admin/stats.html` (instance statistics, login required) |
| Misc | `errors/error.html`, `tree/prettify_text.html`, `macros/macros.html`, `partials/top_navbar.html` |

Jinja globals available in every template (see `app.jinja_env.globals` in
`website/web/__init__.py`): `get_sri`, `shorten_string`, `sizeof_fmt`,
`get_icon`, `hash_icon`, `details_modal_button`, `tz_info`, `generic_type`,
`load_custom_css`, `load_custom_js`, `http_status_description`, `month_name`.
Filters: `markdown`, `b64encode`. Some HTML is also built in Python
(`SafeMiddleEllipsisString`, `get_icon`, table row rendering inside
`post_table`) — check there before assuming markup lives only in templates.

### Hard constraints (do not break)

- **SRI**: every `<script>`/`<link>` to `static/` uses
  `{{get_sri('static', 'file')}}`. After adding or modifying ANY file in
  `website/web/static/`, run `poetry run tools/generate_sri.py` or the browser
  will refuse to load it (integrity mismatch). The generator walks all
  sub-folders (it skips instance `overrides.*`). `ignore_sri: true` in
  generic.json disables it for development — never commit that.
- **CSP**: Talisman enforces `default_csp.py`. No external CDNs (everything is
  served locally), inline `<script>` must carry `nonce="{{ csp_nonce() }}"`.
  Prefer adding JS in static files over inline handlers.
- **Third-party libs** (jQuery, DataTables BS5, D3, json-viewer) are downloaded
  by `tools/3rdparty.py` into `static/vendor/` and are git-ignored; Bootstrap is served by
  bootstrap-flask (`BOOTSTRAP_SERVE_LOCAL`). Adding a lib = add it to
  `3rdparty.py` + regenerate SRI.
- **IDs and data-attributes are an API**: `render_tables.js` binds to element
  IDs (`#IndexTable`, `#categoriesTable`, `#HHHDetailsTable`, …) and to the
  JSON shape returned by `post_table`; `tree.js` reads `#menu_horizontal_content`,
  `#menu_vertical`, `#tree_svg` and `data-remote`/`data-urlnode` on `#tree_js`;
  modals load HTML fragments by `data-remote`. Keep them or update both sides.
- **Playwright tests** (`tests/test_generic.py`) rely on page titles and some
  selectors/texts; update them along with the UI.
- **Dark mode**: `theme_toggle.js` sets `data-bs-theme` on `<html>`; any new
  styling must work for both `light` and `dark`.
- **Instance customisation hooks** must keep working: `custom_header.html`,
  `custom_footer.html` (templates root), `static/css/overrides.css`,
  `static/js/overrides.js` (loaded via `load_custom_css/js`),
  `static/custom-favicon.ico`, `custom_csp.py`.
- Private captures: URLs may carry a `?seed=` parameter; keep passing `seed=seed`
  in `url_for(...)` calls in capture-related templates.

### Security rules for front-end work

Lookyloo renders data coming from hostile websites (titles, URLs, headers,
cookies, page content). Treat all of it as attacker-controlled.

- Jinja autoescape is on and templates never use `|safe`: keep it that way.
- HTML built in Python must use `Markup('<a>{x}</a>').format(x=value)` (which
  escapes `value`), never an f-string or `+` into `Markup`.
- In JS, render data with `textContent` / DOM APIs. `innerHTML` is only acceptable
  for HTML fragments rendered (and escaped) by Flask, as the modal loaders do.
  Known pre-existing risky sink: the categories list in `render_tables.js`
  (`innerHTML` with `${item}`).
- No external resources (CDN, Google Fonts, analytics): vendor them into `static/`.
- No inline event handlers (`onclick=`…); attach listeners in static JS files.
- There are no CSRF tokens. Flask is configured with `SameSite=Strict`, but
  Talisman overrides it: the session cookie is actually sent as
  `Secure; HttpOnly; SameSite=Lax`, so the existing GET routes that change state
  (remove, rebuild, trigger_indexing…) are reachable by cross-site top-level
  navigation. Do not relax cookie settings further; use POST for new
  state-changing actions.

### Conventions

- Python: typed (mypy strict-ish, see `mypy.ini`), `from __future__ import annotations`,
  4-space indent.
- JS: plain ES (no build step, no bundler), `"use strict"`, jQuery + DataTables
  APIs, D3 v7 for the tree.
- No frontend build tooling exists; introducing one (Vite, Tailwind CLI, …) means
  also wiring it into `update.py`/Dockerfile/CI and SRI generation — discuss first.
- Commit message prefixes used upstream: `new:`, `chg:`, `fix:`.
