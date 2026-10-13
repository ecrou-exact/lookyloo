# Landing page (recent captures)

Route `index` (`/index`, also `/` unless `index_is_capture` is set), hidden
captures on `index_hidden` (`/hidden`, logged-in users). Template
`home/index.html`, CSS `css/index.css`. Design direction: mockup F ("report"),
see the redesign notes.

## Hero: quick capture

The top block (`.lk-hero`) has three parts:

- **Brand** (left, on top on small screens): the logo (`.lk-logo`, inverted in
  dark mode) and "Web forensics tool".
- **Form**: headline "See where a link really goes.", one-sentence explanation,
  the **capture bar** (`.lk-capture-bar`: globe icon + URL field + Capture
  button in one box, with the focus ring on the whole bar), then the **options**
  as pill selects (`.lk-pill-select`: icon + native `<select>` without its
  arrow, caret drawn in CSS) and links to all capture options / upload.
- **Three points** (`.lk-hero-features`): real browser, every hop and resource,
  a link to share. Descriptions are hidden on phones.

The form posts to `/capture` (same handler as the full form, `capture_web`)
with:

| Field | Value |
|-------|-------|
| `url` | The URL typed by the user (scheme optional, like the full form) |
| `device_name` | Default desktop device, or default mobile device (`UserAgents.default['default_device_name']` / `['default_mobile_device_name']`) |
| `visibility` | `public` / `unlisted` / `private`, preselected from `default_public` / `default_private` |
| `java_script_enabled` | Always on (default of the full form) |
| `name` | Honeypot (`.boatymcboat`), must stay empty |

"All capture options" links to the full form (`capture_web`), "Upload a
capture" to `submit_capture`.

## Recent captures list

A server-side DataTable: `#IndexTable` with `data-indextype="index|hidden"`,
configured in `js/render_tables.js`, fed by `POST /tables/indexTable/<index|hidden>`
(`post_table()` in `website/web/__init__.py`).

JSON row shape (the contract between `post_table()` and `render_tables.js`):

```json
{"page": {"display": "<html of the row>", "filter": "title + URLs"},
 "capture_time": "2026-10-08T06:57:16.613000+00:00"}
```

- `page.display` is rendered by `index_capture_template` (Jinja, autoescaped):
  title linking to the capture, initial URL with copy button, facts (capture
  error, number of redirects, final hostname when it differs), and a collapsible
  redirect chain with a download link.
- `capture_time` is displayed by `DataTable.render.relative_time()`
  (`js/generic.js`): "5 days ago" + the exact date (tooltip and second line).

**Only data from the capture cache is used** (`CaptureCache`: uuid, title, url,
redirects, timestamp, error). The tree pickle is never loaded for the list:
the page is public and must stay cheap for bots. Other cheap data (counts of
hostnames, domains, IPs from the per-capture index) is possible but not used
yet; request counts, screenshots and verdicts are not cheap. See the data
availability analysis before adding a field.

Search filters titles and URLs (DataTables search box, server-side).
Logged-in users switch between public and hidden captures with the
Public / Hidden control; a category filter (`?category=`) shows as a removable
chip.
