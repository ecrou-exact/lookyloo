# Search page

Route `search` (`/search`), template `home/search.html`, CSS `css/search.css`.

Page header ([page-header.md](../page-header.md)) then one card (`.lk-search`):
one tile per criterion (icon, label, hint, field) on two columns (one on
phones). Field names are unchanged (`url`, `ip`, `ressource`, `cookie`,
`favicon_sha512`, `favicon_file`): the `search()` view uses the first one that
is filled and redirects to the matching pivot page. The submit button shows the
Lookyloo eyes while searching (`data-lk-loading`).
