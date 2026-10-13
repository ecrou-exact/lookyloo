# Resources page

Route `ressources` (`/ressources`), template `explore/ressources.html`, CSS
`css/resources.css`. Lists the resources (body hashes) seen in the recent
captures with their known context.

Columns:

- **Resource**: icon of the generic type (`generic_type(mimetype)` -> Bootstrap
  icon, `type_icons` in the template; links to the download by hash), file name
  (link to the pivot page), mimetype, short SHA512 with a copy button.
- **Context**: pill from `find_known_content()` (`lookyloo/context.py`):
  Malicious (with type/target), Legitimate (on which domains), Library (SaneJS:
  name, version, path), Generic, or Unknown; a legend is shown above the table.
  The "Add context" form (`context_form` macro) is only shown when
  `enable_context_by_users` is set and the user is logged in (the
  `add_context` route requires both).
- **Captures**: number of captures with this resource (default sort).

Search covers file name, mimetype, hash and context type (`data-search`).
