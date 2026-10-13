# Error pages

Template `errors/error.html` (extends `layouts/page.html`): the Lookyloo eyes
(`loader('', size='xl', decorative=True)`, see [loader.md](loader.md)), an
optional code, a title, a message, the requested path (404) and links to the
home page, the recent captures and the search.

| Variable | Use |
|----------|-----|
| `error_title` | Title (default "Something went wrong") |
| `error_message` | One or two sentences explaining what happened |
| `error_code` | Optional, shown above the title (404, 500) |
| `requested_path` | Optional, shown in a code box (404) |

Handlers in `website/web/__init__.py`:

| Handler | Response |
|---------|----------|
| `handle_not_found` (404) | The error page for browsers; `{"message": "Not found."}` (JSON) when the client does not accept HTML |
| `handle_server_error` (500) | Same, "Something went wrong"; the traceback is still logged by Flask |
| `handle_index_error` and the other capture errors | Unchanged behaviour (error page or flash + redirect) |

The REST API (flask-restx, `/json/...`, `/doc`) keeps its own JSON errors: these
handlers only apply to URLs no route matches and to errors of the HTML views.
