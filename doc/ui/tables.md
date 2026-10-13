# Tables (DataTables): pagination, search and filters in the URL

Every DataTable outside a modal (capture lists, categories, explore pages, pivot
pages opened as pages) keeps its state in the URL, so a reload, the Back button
or a shared link opens the same view. Code: top of `js/render_tables.js`.

| Parameter | Meaning |
|-----------|---------|
| `page` | Page number, from 2 (absent on page 1) |
| `length` | Rows per page, only when different from the table default |
| `q` | Text typed in the search box |

When a page holds several tables, the parameters are prefixed with the table id
(`hostnameTable_page=2`). Tables inside modals (capture tree) are not touched:
the URL there belongs to the capture.

## Reset filters

A "× Reset filters" button (`.lk-dt-reset`) is added next to the search box and
shown only when a filter is active: search text, column filters, or a filter
applied by the server from the URL (`LK_URL_FILTERS`, today `category` on the
captures list). Clicking it clears the search (and the page), or reloads the
page without the URL filters.

## How it works (DataTables 3)

- Listeners are bound on each table when `render_tables.js` runs, before the
  tables are created: `preInit.dt` (jump to the requested page before the
  first load), `init.dt` (apply search, page size and page that could not be
  applied before), `draw.dt` (update the URL with `history.replaceState` and the
  reset button). They must keep the `.dt` namespace: jQuery only calls handlers
  bound with the namespace of the triggered event.
- DataTables 3 settings use `pageLength`, `displayStart`, `features`, `init`
  (not `_iDisplayLength`, `oFeatures`...); `columns().search()` returns an array.
- The first draw does not touch the URL: the requested state is read once in
  `preInit` and applied in `init`.
