# Page header (breadcrumb + title card)

Macro `page_header()` in `templates/macros/page.html`, CSS
`static/css/components/page-header.css` (loaded on every page).

```
Home / Explore / Cookies                     <- breadcrumb, Home always first
┌──────────────────────────────────────────┐
│ [icon]  Cookies                [actions] │ <- card: icon, h1, description,
│         Names of the cookies set by ...  │    optional actions on the right
└──────────────────────────────────────────┘
```

## Usage

In a template extending `layouts/page.html`:

```jinja
{% from 'macros/page.html' import page_header %}

{% block page_header %}
{{ page_header('Cookies',
               description='Names of the cookies set by the pages of the recent captures.',
               icon_name='misp:attributes/cookie',
               crumbs=[('Explore', None)]) }}
{% endblock %}
```

With actions (buttons, switches) on the right of the card:

```jinja
{% block page_header %}
{% call page_header('Recent captures', icon_name='bi:collection') %}
  <a class="btn btn-outline-primary" href="...">Export</a>
{% endcall %}
{% endblock %}
```

| Parameter | Default | Effect |
|-----------|---------|--------|
| `title` | required | `<h1>` of the page and last item of the breadcrumb (`aria-current="page"`) |
| `description` | `None` | One sentence under the title: what the page is for |
| `icon_name` | `None` | Icon in the accent square: `bi:<name>` or `misp:<set>/<name>` ([icons.md](icons.md)); picked up automatically by `tools/build_icons.py` |
| `crumbs` | `()` | Levels between Home and the page: list of `(label, url)`; `url=None` for a level without a page (e.g. "Explore", "Admin") |

The breadcrumb always starts with "Home" (`landing_page`); separators are `/`.

## Pages using it

| Page | Breadcrumb | Icon |
|------|------------|------|
| Recent captures / Hidden captures | Home / (Recent captures /) … | `bi:collection` / `bi:eye-slash` + Public/Hidden switch as action |
| Search | Home / Search | `bi:search` |
| Categories | Home / Categories | `misp:simple/taxonomy` |
| New capture | Home / New capture | `bi:camera` |
| Submit an existing capture | Home / New capture / … | `bi:upload` |
| Capture for takedown | Home / New capture / … | `bi:flag` |
| Ongoing captures (bulk) | Home / New capture / … | `bi:collection-play` |
| Cookies, Resources, Favicons, HTTP headers hashes | Home / Explore / … | `misp:attributes/cookie`, `misp:attributes/sha256`, `bi:image`, `bi:fingerprint` |
| Statistics | Home / Admin / Statistics | `bi:graph-up` |
| Log in | Home / Log in | `bi:box-arrow-in-right` |

The home page (hero), the error pages and the capture tree do not use it.
