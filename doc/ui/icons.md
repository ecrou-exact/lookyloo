# Icons

All UI icons come from **one SVG sprite** committed in the repository,
`website/web/static/images/icons/sprite.svg`, and are rendered with the
`icon()` Jinja helper. The sprite only contains the icons actually used (a few
KB), so pages no longer download bootstrap-flask's full 1.1 MB sprite.

Two icon sets are available:

| Prefix | Set | Source | Browse |
|--------|-----|--------|--------|
| `bi:<name>` | [Bootstrap Icons](https://icons.getbootstrap.com/) (~2000 generic UI icons) | sprite shipped by bootstrap-flask (Python dependency) | icons.getbootstrap.com, or `tools/build_icons.py --list bi` |
| `misp:<set>/<name>` | [misp-iconify](https://github.com/MISP/misp-iconify) (MISP attribute types, objects, galaxies…) | git submodule `tools/misp-iconify` | its README, or `tools/build_icons.py --list misp:attributes` |

MISP sets (folders of `src/svg/`): `attributes`, `objects`, `objects-framed`,
`galaxies`, `galaxies-orbit`, `simple`, `hexagone`.

Use Bootstrap Icons for generic actions (download, share, close, lock…) and
MISP icons for threat-intel concepts (domain, IP, file, x509, tag…), so that
Lookyloo speaks the same visual language as MISP.

## Usage in templates

`icon` is a Jinja global, no import needed:

```jinja
{{ icon('bi:cloud-download') }}                          {# decorative #}
{{ icon('bi:share', title='Share this capture') }}       {# meaningful: label + tooltip #}
{{ icon('misp:attributes/domain', classes='lk-icon-lg text-danger') }}
{{ icon('misp:objects/x509', size='32') }}
```

| Parameter | Default | Effect |
|-----------|---------|--------|
| `name` | required | `bi:<name>` or `misp:<set>/<name>` |
| `title` | `None` | Without it the icon is decorative (`aria-hidden="true"`). With it the icon gets `role="img"`, an `aria-label` and a `<title>` (tooltip). Use it when the icon is the only content of a button or link. |
| `classes` | `''` | Extra CSS classes on the `<svg>` |
| `size` | `None` | Sets `width`/`height` attributes (e.g. `'32'`); prefer the CSS size classes |

Output:

```html
<svg class="lk-icon" aria-hidden="true" focusable="false">
  <use href="/static/images/icons/sprite.svg?v=Bel40tiHDFNq#bi-share"></use>
</svg>
```

The `?v=` parameter comes from the sprite's SRI hash: `<use>` cannot carry an
`integrity` attribute, so the URL changes whenever the sprite changes and
browsers fetch the new version.

In Python (HTML built in `__init__.py`), `icon()` returns `Markup` and can be
used inside `Markup('…{i}…').format(i=icon('bi:x'))`.

## Styling (`css/components/icon.css`)

Icons are `1em` square and use `currentColor`: they follow the font size and
the text colour of their parent, in light and dark mode.

| Class | Size |
|-------|------|
| `lk-icon` | 1em (always present) |
| `lk-icon-sm` | 0.875em |
| `lk-icon-lg` | 1.25em |
| `lk-icon-xl` | 1.5em |
| `lk-icon-2x` | 2em |

Colour them with the text colour: `text-danger`, `text-body-secondary`, or a
parent's `color`.

## Adding an icon

1. Use it in a template: `{{ icon('misp:attributes/ip-dst') }}`.
2. Rebuild the sprite, then the SRI hashes:

   ```bash
   poetry run tools/build_icons.py
   poetry run tools/generate_sri.py
   ```

3. Commit the template, `sprite.svg` and `sri.txt` together.

`build_icons.py` finds the icons by scanning `website/web/templates/**/*.html`
and `website/web/*.py` for quoted icon names (`'bi:…'`, `'misp:<set>/…'`): in
`icon('…')` calls, but also in macro parameters such as
`page_header(..., icon_name='bi:search')`. If a name is
built at runtime (`icon('bi:' ~ name)`), list every possible value in
`tools/icons_extra.txt`.

`icon()` logs a warning (`Icon … missing from the sprite`) when a name is not in
the sprite; the icon then renders empty.

`poetry run tools/build_icons.py --check` exits with an error if the sprite is
not up to date (usable in CI).

## The misp-iconify submodule

MISP icons need the sources, which are a git submodule configured with
`update = none` and `shallow = true`. Lookyloo instances never download it (the
sprite is committed), and `git submodule update` skips it. To work on icons:

```bash
git submodule update --init --checkout tools/misp-iconify
```

Do **not** use `--recursive`: misp-iconify has its own submodules
(misp-objects, misp-galaxy) with SSH URLs, which are not needed here.

To update the MISP icons to a newer version:

```bash
git -C tools/misp-iconify pull origin main
poetry run tools/build_icons.py && poetry run tools/generate_sri.py
git add tools/misp-iconify website/web/static/images/icons/sprite.svg website/web/sri.txt
```

If the submodule is not checked out, `build_icons.py` keeps the MISP symbols
already in the sprite (with a warning), so Bootstrap icons can still be added.

## Security

Icon sources are sanitised when the sprite is built: only a whitelist of SVG
drawing elements and attributes is kept (no `<script>`, `<foreignObject>`,
`<image>`, event handlers, `style` or external references), `url(#id)`
references must point inside the same icon, and internal ids are prefixed with
the icon name so they stay unique in the sprite. The sprite is served from
`static/`, so it is allowed by the CSP (`default-src 'self'`).

## Legacy icons

`get_icon()`, `hash_icon` and the PNG images in `static/images/icons/` (tree
node icons, mimetypes, HTTP status) are not part of this system yet; they will
be migrated with the capture page.
