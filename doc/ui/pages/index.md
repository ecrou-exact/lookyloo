# Recent captures (index)

Route `index` (`/index`, "Captures" in the header), hidden captures on
`index_hidden` (`/hidden`, logged-in users). Template `home/index.html`, CSS
`css/index.css`. This page only lists captures: the capture form is on the
home page ([home.md](home.md)).

Title "Recent captures" (or "Hidden captures") with a one-line explanation,
then the list.

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
  - a **screenshot thumbnail**, always blurred (captured pages can be anything,
    porn included); a click toggles the blur (`.lk-thumb`, handler in
    `js/generic.js`). Loaded lazily from `/tree/<uuid>/thumbnail/256`, which
    sends `Cache-Control: private, max-age=86400` (a screenshot never changes).
    The blur is visual comfort, not protection: the image is downloaded anyway.
    Server side, thumbnails of widths 64, 128 and 256 made from a real
    screenshot are stored in `<LOOKYLOO_HOME>/thumbnails/<uuid[:2]>/<uuid>-<width>.png`
    the first time they are requested (`Lookyloo.get_screenshot_thumbnail`), so
    later requests do not decode the full screenshot again. Not stored in the
    capture directory on purpose (`get_screenshot()` and exports read every
    `*.png` there). No cleanup yet: removing the folder is always safe;
  - the title linking to the capture and the initial URL with a copy button;
  - facts: capture error, **hostname trail** (`google.com › www.google.com`,
    consecutive identical hosts merged, middle hosts collapsed into "+n" after
    4), "Unencrypted hop" when a step uses plain HTTP, or "No redirect";
  - the **redirect chain** (collapsible): one step per URL on a vertical route
    (hollow dots, filled dot for the final page), labelled Start / Redirect n /
    Final page, with "new host" and "HTTP" badges, host in bold, rest of the URL
    muted, a copy button per step, and a link to download the redirects.
  The hops are prepared by `redirect_hops()` and each row by `index_row()` in
  `website/web/__init__.py` (also used for the latest captures on the home
  page); row styles are in `css/components/capture-list.css`.
- `capture_time` is displayed by `DataTable.render.relative_time()`
  (`js/generic.js`): "5 days ago" + the exact date (tooltip and second line).

**Only data from the capture cache is used** (`CaptureCache`: uuid, title, url,
redirects, timestamp, error), plus the thumbnail, fetched separately by the
browser. The tree pickle is never loaded for the list:
the page is public and must stay cheap for bots. Other cheap data (counts of
hostnames, domains, IPs from the per-capture index) is possible but not used
yet; request counts, screenshots and verdicts are not cheap. See the data
availability analysis before adding a field.

Search filters titles and URLs (DataTables search box, server-side).
Logged-in users switch between public and hidden captures with the
Public / Hidden control; a category filter (`?category=`) shows as a removable
chip.

## Number of captures

The header shows the number of captures of the list (`#capture-total`,
`total_captures` from `index_generic()`): the recent captures, not archived,
counted in Valkey without loading them (`ZCARD recent_captures_public` for
the public list, `recent_captures` minus the public ones for the hidden list).

## Hidden captures

`/hidden` (admins) lists only the captures that are not on the public index:
unlisted (`no_index`) or private. `get_index(public=False)` gets every capture,
then keeps those (`cached.no_index or cached.private`), so a capture is never
in both lists.

## Tutorial

The tour of the page (`{% block tour %}` in `home/index.html`) explains the
filters (search, rows per page, category, public / hidden) and every part of a
capture row (screenshot, title, verdict, URL, redirects and warnings,
categories, date), on the first row of the list. On an empty list, an example
row is shown while the tour runs (`js/capture_list_demo.js`: built with DOM
APIs, marked **Example**, the same classes as the real rows), and removed when
it ends: the page listens to the `lk-tour:before-start` / `lk-tour:stop` events
of `js/tour.js`.
