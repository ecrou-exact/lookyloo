# Lookyloo web UI documentation

Documentation of the web interface (`website/web/`) built during the UI
redesign. Every feature or component added to the UI gets a page here, in the
same commit as the code.

| Page | Content |
|------|---------|
| [layout.md](layout.md) | Layouts (`base.html`, `page.html`), header, footer, how to create a page |
| [pages/home.md](pages/home.md) | Home page: logo, quick capture form, key points, latest captures |
| [pages/capture.md](pages/capture.md) | Full capture form: sections, summary panel, field contract |
| [pages/submit-capture.md](pages/submit-capture.md) | Import a capture: pull, export or HAR |
| [pages/resources.md](pages/resources.md) | Resources page: type icon, context pills |
| [pages/search.md](pages/search.md) | Search page: one card, a tile per criterion |
| [pages/index.md](pages/index.md) | Recent captures page: the list and the data it uses |
| [page-header.md](page-header.md) | Page header component: breadcrumb + card with icon, title, description |
| [pivot-pages.md](pivot-pages.md) | Pivot pages (hostname, IP, favicon, resource, cookie...): page and modal modes |
| [tags.md](tags.md) | Category tags: coloured pills with icons |
| [credits.md](credits.md) | Credits & licenses page (footer link) |
| [tables.md](tables.md) | Tables: page, page size and search in the URL, reset filters button |
| [offline.md](offline.md) | No CDN: runtime is fully local, offline installation of the vendor libraries |
| [errors.md](errors.md) | Error pages (404, 500) with the Lookyloo eyes |
| [loader.md](loader.md) | Loading indicator with the Lookyloo eyes (`loader()` macro) |
| [css.md](css.md) | How the stylesheets are organised: files, load order, where to put new CSS, rules |
| [icons.md](icons.md) | Icons: `icon()` helper, Bootstrap Icons + misp-iconify sprite, adding an icon, the submodule |
| [theme.md](theme.md) | Design tokens (`--lk-*`): colours, typography, radii, spacing, light/dark, how to add a theme |

Architecture, template map and security constraints: see `AGENTS.md` at the
repository root.
