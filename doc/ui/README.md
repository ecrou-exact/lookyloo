# Lookyloo web UI documentation

Documentation of the web interface (`website/web/`) built during the UI
redesign. Every feature or component added to the UI gets a page here, in the
same commit as the code.

| Page | Content |
|------|---------|
| [layout.md](layout.md) | Layouts (`base.html`, `page.html`), header, footer, how to create a page |
| [pages/index.md](pages/index.md) | Landing page: quick capture, recent captures list and its data |
| [loader.md](loader.md) | Loading indicator with the Lookyloo eyes (`loader()` macro) |
| [css.md](css.md) | How the stylesheets are organised: files, load order, where to put new CSS, rules |
| [icons.md](icons.md) | Icons: `icon()` helper, Bootstrap Icons + misp-iconify sprite, adding an icon, the submodule |
| [theme.md](theme.md) | Design tokens (`--lk-*`): colours, typography, radii, spacing, light/dark, how to add a theme |

Architecture, template map and security constraints: see `AGENTS.md` at the
repository root.
