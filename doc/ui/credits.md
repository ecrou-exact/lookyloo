# Credits & licenses page

Route `credits` (`/credits`), template `about/credits.html`, linked from the
footer ("Credits & licenses"). It lists the open source projects the interface
ships or relies on, with their licenses: Lookyloo itself, the design assets
(Geist fonts - OFL 1.1, Bootstrap Icons - MIT, misp-iconify - BSD-2-Clause), the
front-end libraries (Bootstrap, Bootstrap-Flask, jQuery, DataTables, D3,
jquery.json-viewer, Vitrine), the libraries bundled in the build of Vitrine
(highlight.js, marked, DOMPurify, Lucide, Apache ECharts / ZRender, js-yaml:
from its `THIRD_PARTY_NOTICES.md` at the commit pinned in `tools/3rdparty.py`;
check it again when the commit changes) and the main server components.

Licenses were checked against the package metadata / npm registry / licence
files. **When adding a library, a font or an icon set, add it to this page**
(macro `credit(name, role, license, url, license_url)` in the template).
Fonts also keep their licence file next to them (`static/vendor/fonts/geist/OFL.txt`, installed by `tools/3rdparty.py`).
