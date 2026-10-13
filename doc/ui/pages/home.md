# Home page

Route `landing_page` (`/`). Template `home/home.html`, CSS `css/home.css`,
rendered by `home_page()` in `website/web/__init__.py`. If `index_is_capture`
is set in `config/generic.json`, `/` still redirects to the full capture form
(public instance behaviour).

The home page is the "showcase" of the instance: logo, what Lookyloo does, a
quick capture form, then the latest public captures. The complete list (search,
pagination, hidden captures) is the index page, [index.md](index.md).

## Hero

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

## Latest captures

The `HOME_LATEST_CAPTURES` (10) most recent public captures, rendered server
side (no DataTable, no search, no pagination) with the same rows as the index
page: `index_row()` + `index_capture_template`, styles in
`css/components/capture-list.css`. Same cost as the first page of the index
(capture cache only). Times are turned into relative times by `js/generic.js`
(`<span data-lk-time="ISO date">`). "See all captures" links to the index page;
an empty state invites to make the first capture.
