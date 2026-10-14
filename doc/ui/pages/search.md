# Search page

Route `search` (`/search`), template `home/search.html`, CSS `css/search.css`.

Page header ([page-header.md](../page-header.md)) then one card (`.lk-search`):
one tile per criterion (icon, label, hint, field) on two columns (one on
phones). Field names are unchanged (`url`, `ip`, `ressource`, `cookie`,
`favicon_sha512`, `favicon_file`): the `search()` view uses the first one that
is filled and redirects to the matching pivot page. The submit button shows the
Lookyloo eyes while searching (`data-lk-loading`).

## Wrong input

The old page redirected whatever was typed: a resource or favicon field
holding anything but a SHA512 (e.g. `sha512`, the placeholder) led to
`/body_hashes/sha512` and a 404. Now `search()`:

- cleans the hashes (spaces, line breaks, upper case: `sha512_of()`) and only
  redirects a real SHA512 (128 hexadecimal characters);
- otherwise shows the form again (`back_to_form()`): a flashed error that says
  what is expected, and the fields keep what was typed (`values`, the posted
  form). Same for a URL field that is neither a URL nor a hostname, an empty
  favicon file, and a form sent with nothing filled (the browser always sends
  the file field: only a chosen, non-empty file counts);
- the hash fields also have a `pattern` (128 hexadecimal characters, spaces
  around allowed), so the browser warns before sending.

The hash fields say where to copy a SHA512 from (Analysis > Resources or
Favicons of a capture, Explore > Resources); their placeholder is the start of
a real-looking hash ("Paste a SHA512, e.g. cf83e1357eefb8bd…"), not a word
that could be taken for a value to type.
