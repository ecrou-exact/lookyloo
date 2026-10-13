# Layouts, header and footer

Every HTML page extends one of two layouts in `website/web/templates/layouts/`.

| Layout | Use it for | Gives you |
|--------|------------|-----------|
| `base.html` | Full-screen or embedded pages: the capture tree (`tree/tree.html`), popups (`tree/hostname_popup.html`, pages opened with `from_popup=True`), modal pages | The document skeleton only: `<head>`, CSS, JS, theme, instance hooks |
| `page.html` | Every normal page (home, capture forms, search, explore, statistics, login, errors…) | `base.html` + skip link + site header + flashed messages + `<main>` column + footer |

```
base.html
├── <head>: theme_toggle.js (applies the colour theme before the first paint),
│           CSS (see css.md), page_styles block, overrides.css
├── custom_header.html (instance hook, optional)
├── block body ─────────────── replaced by page.html:
│     <div id="content" class="container"> block content </div>
│                                   ├── partials/header.html
│                                   ├── <main id="main"> lk-container
│                                   │      flashed messages
│                                   │      block page_header
│                                   │      block main (default: block content)
│                                   └── partials/footer.html
├── custom_footer.html (instance hook, optional)
└── block scripts (Bootstrap, jQuery, DataTables, generic.js, render_tables.js, overrides.js)
```

## Creating a page

```jinja
{% extends "layouts/page.html" %}
{% from 'macros/page.html' import page_header %}

{% block title %}My page{% endblock %}

{% block page_styles %}   {# optional, only if the page has its own CSS #}
<link rel="stylesheet" href="{{ url_for('static', filename='css/mypage.css') }}"
      {{get_sri('static', 'css/mypage.css')}} crossorigin="anonymous">
{% endblock %}

{% block page_header %}
  {% call page_header('My page', lead='One sentence explaining what this page is for.') %}
    <a class="btn btn-outline-primary" href="...">{{ icon('bi:download') }} Export</a>
  {% endcall %}
{% endblock %}

{% block main %}
  ...
{% endblock %}
```

Then in Python: `return render_template('feature/mypage.html', ...)`.

### Blocks of `page.html`

| Block | Content |
|-------|---------|
| `title` | `<title>` text (Playwright tests check some titles) |
| `page_styles` | Page CSS, loaded before the instance `overrides.css` |
| `page_header` | Title area; use the `page_header()` macro |
| `main` | The page content |
| `main_class` | Extra classes on the content column, e.g. `lk-container-narrow` (960px) |
| `scripts` | Page JS: `{{ super() }}` then your `<script nonce="{{ csp_nonce() }}">` |
| `card`, `identity` | OpenGraph / `rel="me"` tags (home page) |

Legacy pages that still fill `content` instead of `main` also work: `main`
renders `content` by default.

Flashed messages (`flash('…', 'error')`) are displayed by the layout. Do not
call `render_messages()` in a page that extends `page.html`, or they appear
twice.

### Page building blocks

| Name | Where | Use |
|------|-------|-----|
| `page_header(title, lead=None)` + `{% call %}` for actions | `macros/page.html` | Page title, lead, action buttons |
| `.lk-container`, `.lk-container-narrow` | `css/components/layout.css` | Content width (1440px wide layout, 960px narrow) |
| `.lk-card` | `css/components/layout.css` | Bordered surface box |
| `.lk-section-title` | `css/components/layout.css` | Title of a section inside a page |
| `icon()` | Jinja global | Icons, see [icons.md](icons.md) |
| `loader()` | `macros/loader.html` | Loading indicator, see [loader.md](loader.md) |

## Decorative background

Every page using `page.html` has a decorative background
(`<div class="lk-backdrop">` in `<main>`, styles in `css/components/layout.css`):
an accent glow and a faint capture tree (`static/images/ui/backdrop-tree.svg`,
generated once, used as a CSS mask so it takes the accent colour of the theme),
centred in the window, fading out towards the edges, fixed while scrolling. Its
strength comes from CSS variables: `--lk-backdrop-tree-opacity` and
`--lk-backdrop-glow`. The home page sets stronger values
(`css/home.css`, `body.lk-page-home`). Pages that should not have it can set
`--lk-backdrop-tree-opacity: 0; --lk-backdrop-glow: 0` through `body_attrs`
(block on `<body>` in `base.html`: `{% block body_attrs %} class="..."{% endblock %}`).

## Back to top button

`layouts/page.html` ends with a round "Back to top" button
(`#lk-back-to-top`, `css/components/back-to-top.css`, `js/back_to_top.js`),
fixed bottom right. It appears once the page is scrolled by more than 400px,
scrolls smoothly back to the top (instantly with `prefers-reduced-motion`) and
moves the keyboard focus to `<main>` (`tabindex="-1"`). While hidden it is not
reachable with the keyboard.

## Header (`partials/header.html`)

From left to right:

- **Logo**: link to the home page (`landing_page`, `/`; the full capture form
  instead when `index_is_capture` is set).
- **Main links**: Recent captures (`index`, also active on `index_hidden`),
  Search, Categories, **Explore** menu (resources, cookies, favicons and HTTP
  headers hashes seen in recent captures), **Help** menu (documentation, API,
  changelog, project page).
- **Theme selector**: light / dark / auto, driven by `js/theme_toggle.js`. Its ids
  and classes (`#bd-theme`, `#bd-theme-text`, `.theme-icon-active`,
  `data-bs-theme-value`) are the script's API.
- **User menu** when logged in (hidden captures, statistics, log out), or a
  **Log in** link.
- **New capture** button, with a menu for submitting an existing capture and, for
  logged-in users when `enable_takedown_form` is set, the takedown form.

The current section is highlighted by comparing `request.endpoint` with the
endpoints given to the `nav_link()` macro at the top of the file. To add an
entry: `{{ nav_link('Label', 'endpoint_name', also=('other_endpoint',)) }}`.

Below 992px the links collapse behind the "Toggle navigation" button.

## Footer (`partials/footer.html`)

Version, one-line description, links to the documentation, API, changelog and
source code. Instances add their own content with `templates/custom_footer.html`
(and `custom_header.html` above the header), both included by `base.html`.

## Variables available in every template

Injected by the `inject_layout_context()` context processor in
`website/web/__init__.py`:

| Variable | Value |
|----------|-------|
| `lookyloo_version` | Installed Lookyloo version |
| `enable_takedown_form` | `generic.enable_takedown_form` config value |

## Login page

`admin/login.html` (route `login`, GET). The form posts `username` and
`password` to the same route.
