# Pivot pages (investigate/*)

The pages that show one value and the captures it was seen in: favicon,
resource (body hash), cookie name, HTTP headers hash, URL, hostname, domain,
TLD, IP, capture hash (domhash...), identifier. Templates in
`templates/investigate/`, building blocks in `templates/macros/investigate.html`,
CSS `css/components/pivot.css` (loaded everywhere: the pages are also shown in
the tree modals).

Two rendering modes, decided by the `from_popup` query parameter:

- `from_popup=True`: a standalone page (`layouts/base.html`, no site header),
  opened from the capture popups; a "Go back" button is shown.
- otherwise: an HTML fragment injected in a modal of the capture tree
  (`js/tree_modals.js`); an "Open as a page" button opens the standalone page
  in a new tab.

## Building blocks

```jinja
{% from 'macros/investigate.html' import pivot_header, captures_section, pivot_section %}

{{ pivot_header('Hostname', hostname, description='Captures that contacted this hostname.',
                icon_name='misp:attributes/hostname',
                share_url=url_for('hostname_details', hostname=hostname, from_popup=True),
                from_popup=from_popup) }}

{% call pivot_section('CIRCL Passive DNS', icon_name='bi:clock-history') %}...{% endcall %}

{% call captures_section() %}
<table id="hostnameTable" class="table lk-pivot-table" data-hostname="{{hostname}}">...</table>
{% endcall %}
```

| Macro | Content |
|-------|---------|
| `pivot_header(kind, value, description, icon_name / image_src, share_url, from_popup, copy=True)` + `{% call %}` actions | Card: icon (or favicon image), kind, value in monospace with a copy button, description, actions (Shodan, Download, Open as a page) |
| `pivot_section(title, icon_name)` + `{% call %}` | Card with a titled section (file info, headers, Passive DNS) |
| `captures_section(title='Seen in these captures')` + `{% call %}` the table | Card around the captures table |

The captures tables keep their ids and `data-*` attributes (`hostnameTable`,
`data-hostname`, `bodyHashDetailsTable`...): `js/render_tables.js` reads them and
`post_table()` fills them.
