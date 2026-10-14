# Capture page (`/tree/<uuid>`)

Template `tree/tree.html`, CSS `css/tree.css`, JS `js/tree.js` (D3 tree) and
`js/tree_modals.js` (modals, menu actions).

## Layout

```
top block    (#capture_top, sticky)  stays visible while the page scrolls:
  site header (partials/header.html)
  capture bar (.lk-capture-bar)      what was captured + actions, foldable
  messages    (.lk-capture-flashes)  flash messages, dismissible
tree area    (.lk-tree-area)         exactly the rest of the screen:
  tree       (#tree_viewport)        scrolls in both directions, holds #tree_svg
  alerts     (#tree-alerts)          points of attention (chips), top left corner
  controls   (.lk-tree-controls)     orientation, collapse all, expand all, top right corner
  focus pill (#tree-focus)           "Neighbours of …", top left corner, while a node is focused
  loader     (#tree-loading)         centred in the tree area while the tree loads
  legend     (tree/legend.html)      legend & icon filter, bottom right corner
footer       (partials/footer.html)  the site footer, at the bottom of the page
modals       (block content)
```

The page scrolls normally: the tree fills the screen when it opens, the
footer is below it. With the wheel over the tree, going down scrolls the tree
then the page (the footer comes into view); going up scrolls the page back
first (the footer leaves the screen), then the tree (`js/capture_page.js`). `js/capture_page.js` keeps `--lk-capture-top-height`
equal to the height of the top block (ResizeObserver), and `.lk-tree-area`
is `100dvh` minus that height.

The capture bar folds to one line (title + toolbar icons) with the chevron at
its top right (`#capture_fold`, `.lk-capture-bar.is-folded`); the choice is
remembered in `localStorage` (`lk-capture-bar-folded`).

## Capture bar

- **Identity** (keeps at least 30rem; the toolbar goes to the next line
  first): thumbnail of the screenshot (opens `#screenshotModal`),
  favicon and title of the page, captured URL (wraps, 3 lines at most, full
  URL in the title and the copy button), capture time
  (relative, absolute on hover), number of redirects, *Private* flag,
  *Malicious* flag (`capture_verdict()` on the categories) and the category
  tags (`category_tag()`).
- **Toolbar** (`.lk-capture-toolbar`): the **search** field over the tree
  (see *Search*), the *Details* button, then menus with an
  icon per entry (macros `menu_item` / `menu_link` at the top of `tree.html`):
  - **Capture**: details, statistics, storage state, console messages,
    downloads, video, screenshot, MISP export (see *MISP export*);
  - **Analysis**: index capture (when not indexed), *Third parties*
    (third party reports, MISP lookup, historical lookups, Hashlookup) and
    *In this capture* (resources, IPs, hostnames, URLs, favicons, hashes types,
    other identifiers);
  - **Actions**: re-capture, subsequent captures, monitoring, *Organize*
    (when enabled: manage categories, unbookmark all nodes, mark as known),
    then *Share & export* (visibility, MISP push, push to another Lookyloo);
  - **Download**: full capture, tree as PNG, screenshot, HAR, forensic
    acquisition;
  - **Admin** (logged in): rebuild, Ollama report, remove capture;
  - **Report suspicious capture** button (`#report-capture-btn`, red), shown
    when `enable_mail_notification` is on in `config/generic.json`: it opens
    the e-mail notification form (`#emailModal`) sent to the owners of the
    instance; then the help link.
  On small screens the toolbar keeps only the icons.

The menu ids (`#capture-menu`, `#tools-menu`, `#actions-menu`, `#download-menu`,
`#admin-menu`), the action ids (`#removeCapture`, `#unbookmarkAllNodes`,
`#markAsKnown`) and every `data-bs-target` / `data-remote` are read by
`js/tree_modals.js`: keep them.

## Tree viewport

`#tree_viewport` scrolls; `js/tree.js` draws in `#tree_svg` inside it, with at
least the size of the viewport (it no longer depends on the old floating menus).
`scrollIntoView()` (located node, rendered page) works inside the viewport.

## The tree (D3, `js/tree.js`)

`tree.js` only sets **classes** on what it draws; every colour, font and stroke
is in `css/tree.css`, from the `--lk-color-tree-*` tokens (`doc/ui/theme.md`),
so the tree follows the light and dark themes.

| Class | What |
|---|---|
| `.tree-background` | transparent background of the SVG (a click on it clears the focus); the colour of the whole tree area is `--lk-color-tree-canvas`, on `#tree_viewport` |
| `path.link` | links between nodes |
| `.node-card` | the card of a node (hover: accent border) |
| `.node-host`, `.node-host-idna`, `.node-count` | hostname (opens the hostname pop-up), IDNA form, number of URLs |
| `.node-icon-chip`, `.node-icon-count` | chip behind each PNG icon (light in dark mode only), its counter |
| `.node-badge` | insecure / malicious / known / empty badges, inside the card on the right |
| `.node-thumb-frame` | frame of the screenshot thumbnail of the rendered node |
| `circle.node`, `.is-collapsed` | expand / collapse circle (filled when collapsed) |
| `.node_data.is-bookmarked` | bookmarked node (Actions → Organize) |
| `.tree-parent-*` | "triggered from a previous capture" box above the root |
| `#tooltip` | tooltip of the tree |

The PNG export (*Download* > *Tree as PNG*) copies the computed styles
into the exported SVG (`inlineSvgStyles` in `js/tree_modals.js`) and paints
the page background colour behind it, so the image matches the screen. Web
fonts are not embedded in the image (the browser falls back to a system font).
A located node (`?node=` in the URL, or *Locate in tree* in the hostname pop-up:
`LocateNode()` in `js/tree_modals.js`) is centred in the tree and its card glows
in the accent colour (`g.node.is-located`, a soft pulse) with a "This node"
label above it (`.node-located-label`), for 8 seconds or until the next click.

## Legend & icon filter (`tree/legend.html`)

A panel at the bottom right (`<details>`, closed by default). Each entry is a
button with the data key of the node icon it explains (`data-key`: `js`,
`image`, `http_content`, `malicious`… the keys `js/tree.js` reads on a node).
Once the tree is loaded, `setupLegendFilter()` in `js/tree.js`:

- counts, for each key, the nodes of the capture that have the icon
  (`nodeHas()`, same test as the icons of a node) and shows the count;
- keeps the icons of this capture at the top, most frequent first, and moves
  the others (count 0, disabled) to a collapsed **Not in this capture** section;
- clicking entries, **or an icon / badge in a node card**, toggles them
  (`toggleLegendFilter(key)`, which also opens the legend): the nodes having **at least one** of the
  selected icons are highlighted (`g.node.is-filter-match`), the others dimmed
  (`g.node.is-filter-dimmed`); the number of matching nodes shows in the
  panel header, **Clear the filter** resets it. Expanding a node keeps the
  filter.

To add an icon: add it to the `legend` list of `tree/legend.html` with the
same key as in `icon_list()` (or the badge) in `js/tree.js`.

## Messages

Flash messages (capture not indexed, downloads, errors…) are shown under the
capture bar (`.lk-capture-flashes`), dismissible, instead of floating over the
tree.

## Modals

Modals whose content comes from the server are all defined with one macro,
`remote_modal(id, title, loading, note=None, body_id=None)` in
`macros/modals.html` (doc in the file): same ids as before, so the links of the
toolbar and of the loaded fragments (details buttons, `details_modal_button()`)
still target them with `data-bs-target="#<id>"` + `data-remote="<url>"`.
`js/tree_modals.js` listens on every `.modal[data-lk-remote-modal]` (no list
of ids to maintain): it shows the eyes loader, fetches `data-remote` and puts
the answer in `.modal-body`. A list modal and its details modal are separate
modals, so opening details from a list keeps the list.

To add one: a link with `data-bs-toggle="modal"`, `data-bs-target="#myModal"`,
`data-remote="{{ url_for(...) }}"`, and `{{ remote_modal('myModal', 'Title', 'Loading …') }}`
in `tree.html`.

The modals with server-rendered content or forms (details, screenshot,
visibility, push to another Lookyloo, monitoring, e-mail notification) are
still written in `tree.html`.

## Animations

- **Entry**: once the tree is drawn, `animateTreeEntry()` puts every node on
  the root and moves it to its place, one depth column after the other
  (`ENTRY_STEP_MS`, `ENTRY_MOVE_MS`); links fade in behind their node. The
  scroll to the rendered page (or to the located node) waits for the end.
- **Expand / collapse**: nodes and links move to their new place in 300 ms.
- Both are off with `prefers-reduced-motion`.

## Search

The field in the toolbar of the capture bar (`#tree-search`, `setupTreeSearch()` in
`js/tree.js`) searches the hostname, its IDNA form and the resolved IPs of
each node (`nodeText()`). It is a filter like the icons of the legend: a node
is highlighted when it matches the text **and** at least one of the selected
icons (`nodeMatches()`, `applyTreeFilter()`); the others are dimmed.

- the number of matching nodes shows in the field; **Enter** / **Shift+Enter**
  or the arrows centre the next / previous match (`.is-search-current`);
- **/** anywhere on the page focuses the field, **Esc** clears it.

## Neighbours of a node, path to it

A click on a node card (`.node-card`, outside the hostname and the icons)
focuses the node: it (`.is-focused`), its parent and its children stay lit,
the other nodes and the links that don't join two lit nodes are dimmed. A pill
under the search says which node is focused. Click the card again, the
background of the tree, the pill's ✕ or press Esc to show everything. It is a
third filter, combined with the search and the icons (`isNeighbour()` in
`nodeMatches()`).

The **path from the root** to the focused node stays lit too (`focus_path`,
set by `toggleNeighbours()`): its links are dashed in the accent colour and
flow towards the node (`path.link.is-focus-path`, still with
prefers-reduced-motion), the cards on the way get a dashed accent border
(`g.node.is-focus-path`). The pill says "Path to … and its neighbours".

## Moving around the tree

Press anywhere in the tree with the mouse and drag to scroll it
(`js/capture_page.js`, cursor *grab* / *grabbing*): no need for the
scrollbars. A press that doesn't move (less than 4 px) stays a normal click
(card focus, hostname pop-up, icon filter, camera); the click that ends a drag
is swallowed. Touch screens keep their native scrolling.

**Free room around the tree.** The SVG has `PAN_ROOM` (two screens, in layout
units, `js/tree.js`) of empty room on every side (`sizeTreeSvg()`: the viewBox
starts at `-PAN_ROOM`; the background rect covers it too, so a click there
still clears the focus). Only the drag goes there:

- the tree area has **no scrollbars** (they would show the room);
- the **wheel** scrolls inside the tree only (`wheelScroll()`): it stops at
  the edges of the drawn tree (the box of its cards, 40 px around), can come
  back from the room, and at the bottom of the tree going down it scrolls the
  page itself (the footer shows; letting the browser do it would scroll the
  room under the tree). Going up, `js/capture_page.js` scrolls the page back
  first;
- the **drag** goes up to the edge of the room. Past it, the tree follows the
  mouse with resistance (up to 70 px, `stretch()`), that side of the tree area
  glows (`.lk-tree-area.is-edge-{left,right,top,bottom}::after`), and it springs
  back when the button is released (no pull with prefers-reduced-motion);
- **⌖** (`#tree-center`, next to the zoom) brings the centre of the tree to the
  middle of the area (`centerTree()`).

The depth columns of the background follow the room and the zoom
(`applyColumnsGeometry()`), and the PNG export keeps the tree only
(`data-lk-page` on the SVG: its size without the room).

## Scrolling to a node

Every "show this node" (search matches, bookmarks, located node, rendered
page, root after a layout change) uses `centerInViewport(element)` in
`js/tree.js`: it scrolls **only** `#tree_viewport`, never the page
(`scrollIntoView()` would also scroll the page and move the top block).
`js/tree_modals.js` uses it through `window.centerInViewport`.

## Tree controls

Each button shows its icon and a label (`.lk-tree-control-label`: Orientation,
Collapse all, Expand all, Compare, Notes, Background, Full screen), like the
**Legend & filter** button, so the tools are always visible. Under 992px wide
the labels are hidden and the bar shows the icons only.

The first button of the bar (`#tree-controls-compact`, `setupControlsCompact()`
in `js/tree.js`) hides the labels to keep the icons only (`.is-compact` on the
bar), or shows them again; the choice is remembered in `localStorage`
(`lk-tree-controls-compact`). It is not shown on small screens, already icons only.

The buttons at the top right of the tree (`setupTreeControls()` in `js/tree.js`):

- **Orientation**: left to right (default) or top to bottom, remembered in
  `localStorage` (`lk-tree-orientation`). Every position goes through
  `nodePos()` / `nodeTransform()` (d3.tree gives `x` = breadth, `y` = depth):
  horizontal uses `[y, x]`, one column per depth; vertical uses `[x, y]`, one
  row per depth (`VERTICAL_ROW`) and one column (the widest card) per leaf.
  Links go from the right of the parent to the left of the child, or from its
  bottom to the top of the child; the expand / collapse circle follows (right
  side of the card, or middle of its bottom edge), and the favicon / thumbnail
  of the rendered node move aside (`placeNodeParts()`). The button shows the current orientation (⇄ / ⇅ / ◎).
  **Radial** (third click): the root in the centre, one ring per depth
  (`tree.size([2π, radius])`, x = angle, y = radius; `polarPoint()` turns them
  into coordinates around `radial_center`, and the card is centred on its
  point). The rings are spaced for the widest card and long enough for all the
  leaves; links (`radialLink()`) go from card centre to card centre, under the
  cards, curved along the rings; faint circles mark the depths (`g.tree-rings`,
  thicker bands with the *columns* background).
- **Collapse all**: every node but the root is collapsed (the first level stays
  visible).
- **Display** (palette), *Background*: plain, dots, grid or depth columns (one band out
  of two per depth, rows in the vertical layout), drawn by `css/tree.css` on
  the whole tree area (`#tree_viewport.lk-tree-bg-*`, scrolling with the tree)
  with `--lk-color-tree-canvas` / `--lk-color-tree-pattern`; remembered in
  `localStorage` (`lk-tree-background`). Default: plain (a light accent tint).
- **Full screen** (next to Notes): only the tree area, full screen
  (`setupFullscreen()`, Fullscreen API on `.lk-tree-area`): the tree, its
  controls, the legend filter, the chips and the panels stay; Esc or the same
  button leaves it (the icon follows the state). The tree tooltip moves into
  the area while it is full screen (`tipX()` / `tipY()` use screen coordinates
  then), and writing a note leaves the full screen first (the editor is a modal
  of the page). Hidden when the browser has no Fullscreen API.
- **Expand all**: expands level after level while the tree stays under
  `MAX_EXPANDED_NODES` (400) shown nodes, to keep the page fast; when some are
  left collapsed, a message says how many nodes are shown out of the total.

After a change the root is centred once the nodes have moved.

The tree has an 80 px top margin (`margin.top`): the controls and the pill
float over the top of the tree area, and the first rows (the root, the first
search match) must never be hidden under them.

## New capture from a node

Both send `POST /bulk_captures/<uuid>` (`user_urls`): the new capture uses the
settings of this capture (browser, user agent, cookies / storage state,
referer) and has this capture as parent. The page listing the new captures
opens in a new tab.

- **Tree**: a camera at the top right of a card, shown on hover (always on
  touch screens), captures `https://<host>/` (`http://` when the node only has
  plain HTTP content) — `captureHost()` in `js/tree.js`.
- **Hostname pop-up** (`tree/hostname_popup.html`): a *Capture* button on each
  URL of the node captures that exact URL.

## Analysis aids

Computed once on the tree data (`prepareAnalysis()` in `js/tree.js`):

- **Main path**: the nodes and links from the root to the node of the rendered
  page (`contains_rendered_urlnode`) — the redirect chain — are always drawn in
  the accent colour (`.is-main-path`). Hovering a node draws the path from the
  root to it (`path.link.is-hover-path`).
- **Third-party hosts**: a host whose registrable domain differs from the one
  of the rendered page gets `d.data.third_party`, a violet bar on the left of
  its card (`.node-third-party-bar`) and a *Third-party host* entry in the
  legend filter. The registrable domain is approximated without the Public
  Suffix List: the last two labels, three after a known two-level suffix
  (`co.uk`, `com.au`… `TWO_LEVEL_SUFFIXES`).
- **Points of attention** (`#tree-alerts`, `setupAttention()`): one chip per
  kind found in the capture, with the number of nodes — malicious, sending data
  (POST), download, unencrypted, mixed content, redirect to nowhere, third-party
  cookies, third-party hosts (`ATTENTION`, coloured by level). A chip toggles
  the same filter as the legend (each kind is a legend key). No chip when the
  capture has none of them.
- **Network info**: after half a second over a card, a panel next to it
  (`#tree-node-info`, `showNodeInfo()`) shows the host (and *third party*),
  its IPs when the capture resolved them, its DNS zone, SOA (zone and primary
  name server: often the hosting provider or the CDN), NS and MX — from
  `resolved_ips`, `ns`, `mx`, `soa` of the tree dump (`networkLines()`). It
  hides when the pointer leaves the card or a drag starts.

## Notes of the analyst

**Logged-in users (admins) only**: the Notes button, its panel, the note modal
and the pencil on the cards are only rendered when `current_user.is_authenticated`
(`notes_enabled` in `tree/tree.html`, read by `js/tree.js`); anonymous visitors
don't load the stored notes.

- Hover a card and click the **pencil** (next to the camera) to write a note on
  the node, in **Markdown**: the `#noteModal` modal holds a vitrine
  `<vt-markdown mode="edit">` editor with Source / Split / Preview tabs (split
  by default, live preview). Ctrl+Enter saves, an empty note is deleted. A
  node with a note keeps the pencil, in the warning colour, and its note shows
  in the network info panel.
- The **Notes** button of the tree controls (with the number of notes) opens
  the panel listing them, each rendered from its Markdown (`<vt-markdown>`,
  sanitized: raw HTML is shown as text), with **Edit** (opens the modal) and
  **Delete** buttons; click a host to centre its node. **Copy as Markdown** /
  **Download .md** export the capture (URL, title, link, time) and one section
  per noted node, with a link to it, for a report or a ticket.
- Vitrine: doc/ui/vitrine.md.
- Notes are kept **in this browser only** (`localStorage`, key
  `lk-notes:<capture uuid>`): Lookyloo has no per-user storage. They are
  inserted as text (never as HTML).

## Compare with another capture

The **Compare** button of the tree controls opens a panel (`setupCompare()` in
`js/tree.js`):

- the other captures of the same URL (`POST /json/url_info`, newest first),
  or a field for the link or UUID of any capture (a `?seed=` in the link is
  kept, for private captures);
- once one is chosen, its tree is loaded (`/json/<uuid>/tree_dump`) and its
  hostnames compared with this one: the **new hosts** of this capture get a
  green outline (`g.node.is-new-host`), the **hosts gone** (only in the other
  capture) are listed in the panel, with a summary and a link to the other
  capture;
- **Only the new hosts** dims every other node (a fourth filter in
  `nodeMatches()`); **Stop comparing** removes it all.

## MISP export

*Capture > MISP export* opens `#mispExportModal` (`js/capture_components.js`):
the export (`GenericAPI_misp_export`, `data-export` of the link) is fetched and
shown in vitrine `<vt-json>` (tree / raw views, search, copy path or value). It
is not downloaded by itself: **Download** (as `lookyloo-<uuid>.misp.json`) and
**Copy** in the footer, enabled once it is loaded. The exports embed the
resources of the capture (often several MiB): the vitrine size limit is raised
to its maximum (50 MiB) on this page; a bigger export is not shown, a message
says to download it. The viewer has `max-height="60vh"`
(vitrine attribute): its content scrolls inside it, in the tree and raw views
(a CSS height on the element is not enough, the raw view would overflow it).

`js/capture_components.js` is the vitrine module of the page: it imports
`js/vitrine_setup.js` (and so `<vt-markdown>` for the notes) and `<vt-json>`.

Copy buttons (MISP export, notes) say **Copied** (green) or **Copy failed**
(red) for 2 seconds: `copyWithFeedback(button, text)` in
`js/capture_components.js`.

## Tutorial

The capture page has the most detailed tour of the tutorial mode
(doc/ui/tour.md), started by `js/tree.js` once the tree is drawn.

## View the tree from a node

Hover a card (not the root) and click the **diagram** icon, next to the camera
(`.node-view`, `viewFrom()` in `js/tree.js`): the tree is drawn again from
scratch with this host as its root, as if the capture started there — only
this host and what it loaded. It is a filter: the pill **Tree from <host> ✕**
(`#tree-view-from`) shows it, its ✕ (`clearView()`) brings the whole tree back,
with its own collapsed / expanded branches as they were.

The view is a fresh d3 hierarchy of the node's data (`view_root`);
`currentRoot()` is what the tree controls work on (orientation, collapse /
expand all), and the other filters (search, icons, neighbours, compare) apply
to the nodes of the view. The legend (`refreshLegend()`) and the points of
attention (`setupAttention()`) are counted again on the view: icons absent
from it move to the collapsed "Not in this capture" list, and an icon filter
on one of them is removed; the legend hint names the host the counts are
from. ✕ counts them on the whole capture again.

## Size of the cards

A card is `node_height + 5` high (`node_height` = 64 in `js/tree.js`, which also
spaces the rows of the layout) and as wide as its content plus room for its
tools on the first line, at the right (camera, view from here, pencil,
bookmark): they never cover the hostname or the badges.

## Side panel

The entries of the menus (Capture, Analysis, Actions, Download, Admin) open in a
panel at the right of the tree (`#lk-side-panel`, `js/side_panel.js`), not in
modals: the tree stays visible and usable next to it. **Capture details** is in
the Capture menu.

- The panels are still written as Bootstrap modals (`remote_modal()` in
  `macros/modals.html`, or in `tree/tree.html`): IDs, `data-remote` and
  `data-bs-target` don't change. A click on a `[data-bs-toggle="modal"]` link is
  taken over (listener on `window`, capture phase: Bootstrap's delegated
  listeners are on `document`, capture phase too), the modal is moved into
  `.lk-side-panel-stack` and shown as the content of the panel. The
  `show.bs.modal` / `shown.bs.modal` events are sent by the panel with the link
  as `relatedTarget`, so the loaders (`js/tree_modals.js`,
  `js/capture_components.js`) work as before; `hidden.bs.modal` when it closes.
- A link inside a panel (e.g. a hostname in **Hostnames**) opens the next panel
  on top; **Back to …** comes back to the previous one (its remote content is
  loaded again). A link from the menus starts a new history.
- Close: the ✕ of the panel, `Esc`, or any `data-bs-dismiss="modal"` button of
  a panel (their Close buttons are hidden: the panel has its own).
- Width: drag the left edge (or focus it and use the arrows), remembered in
  `localStorage` (`lk-side-panel-width`); the expand button makes it wide. The
  tree controls and the legend move left of the panel, the controls icons only.
- Every panel has the same header (`panel_header()` in `macros/modals.html`,
  `.lk-panel-head`), like the page headers of the site: the icon of its menu
  entry in a tinted square, the title of the menu entry, and one line on what
  it shows. `remote_modal()` takes `icon_name` and `note` for it; the panels
  written in `tree/tree.html` call `panel_header()`. A panel opened from
  another one (e.g. **Hostname** from **Hostnames**) uses the icon of its list.
- A panel whose content cannot be loaded (HTTP error, or a redirect: the site
  sends one with a flashed message when the capture is gone, e.g. removed in
  another tab) shows a warning in the panel, not the page it was redirected to.
- Kept as a real modal: the note editor (`noteModal`, `KEPT_AS_MODALS`).
  Code can open a panel with `window.lkSidePanel.open(id)` (the screenshot of
  the tree does).

### Screenshot panel

**Capture → Page screenshot** (`#screenshotModal`) is always blurred first, with a **Blur / Unblur**
button (`#blurScreenshot`, `js/tree_modals.js`): the page captured may be
shocking, the analyst unblurs it when they want to see it.

## Download menu

The **Download** menu of the toolbar (`#download-menu`, after Actions) has shortcuts to the files of the
forensic acquisition: **Full capture (zip)** (`export`), **Tree as PNG**
(`#tree-download-png`, `downloadSvg()` in `js/tree_modals.js`: the tree as it
is shown, on the background of the tree area), **Screenshot**, **HTTP archive
(HAR)**, and **Forensic acquisition**, the panel with every file and its
trusted timestamp (`downloadModal`). A capture made without trusted timestamps
gets a note there, not a warning (`no_timestamps` in `download_elements`).

The OpenSSL commands to check a trusted timestamp by hand are vitrine
`<vt-terminal>` elements (commands after `$`, a copy button per command).
The download link of each file is shown as a small **Download** button
(`.lk-forensic-table td:nth-child(2) > a`, the label comes from CSS: the
links of the template are icons). The table always has its trusted timestamp and validation columns
(*Unavailable* / *N/A* when there is none).

The **Ollama report** (Admin) sends the redirects, the page as Markdown (cut at
8000 characters) and, when the model can read images (`vision` in its
capabilities), the screenshot. The context of the model is raised to 8192
tokens (`num_ctx` in the `Ollama` settings of `config/modules.json`), or the
start of the conversation would be cut. On a CPU, a report takes minutes:
gunicorn stops a request after 300 s.

On the rendered node, the favicon and the screenshot thumbnail have a frame
(`.node-favicon-chip`, `.node-thumb-frame`, `THUMB_PAD` in `js/tree.js`), so
they show on every background.

## Several icons in the filter: Any (OR) / All (AND)

In the legend, **Several icons** chooses how the icons chosen combine:
**Any (OR)**, the nodes with at least one of them (default), or **All (AND)**,
the nodes with every one of them (`filter_mode` in `js/tree.js`, used by
`nodeMatches()`; remembered in `localStorage`, `lk-tree-filter-mode`). The
other filters (search, neighbours, compare) always combine with AND.

## Zoom

The tree controls have **− / 100 % / +** (`.lk-tree-zoom`: the percentage is
the current zoom, a click on it comes back to 100 %). **Ctrl + mouse wheel** on
the tree also zooms in and out (20 % to 250 %), keeping
the point under the pointer in place; **Ctrl + 0** resets, **Ctrl + +** /
**Ctrl + -** zoom when the pointer is over the tree area (`setupZoom()`,
`setZoom()` in `js/tree.js`). The SVG is drawn at its size times `tree_zoom`,
with a `viewBox` on the size of the layout (`tree_page`, `sizeTreeSvg()`): the
coordinates of the tree don't change, scrolling and centring keep working, and
**Tree as PNG** exports the tree at the current zoom.

## Third party reports

**Analysis → Third party reports** (`modules`, `tree/modals/modules.html`) starts
with the modules that were checked (`checked`), and says when none of them
found anything (`has_hits`): a module without a hit has no section, the panel
was empty before. Modules with an API key (VirusTotal, urlscan.io, Phishing
Initiative…) only run when their key is in `config/modules.json`.

## Keyboard shortcuts

A small keyboard button in the bottom left corner of the tree area
(`.lk-shortcuts`, `#tree-shortcuts-btn`, `setupShortcutsHelp()` in
`js/tree.js`), or **?**, shows the list of the shortcuts of the page (Esc or a
click elsewhere hides it). The list is written in `tree/tree.html`: add a line
there with every new shortcut.

## Size and timings of the hosts (`/json/<uuid>/tree_stats`)

The tree dump has no size or time. `GET /json/<uuid>/tree_stats` (`TreeStats`
in `website/web/genericapi.py`, same `seed` check as `tree_dump`) answers, for
each host node, `{size, start, end}`: the bytes of the response bodies of its
URLs, and the first start / last end of its requests, in milliseconds since the
first request of the capture. `js/tree.js` loads it once, only when a mode needs
it (`loadTreeStats()`): replay, link thickness, heat map.

## Replay of the capture

**Replay** in the tree controls (`#tree-replay`, `setupReplay()` /
`replayCapture()` in `js/tree.js`) plays the capture again: the hosts shown
appear in the order the browser first called them, each with a short accent
glow (`g.node.is-replay-arrived`). The toolbar button becomes **Stop**.

- **When a host arrives**: from `/json/<uuid>/tree_stats` (section above), the
  `start` of the host, i.e. the `startedDateTime` of its first request in the
  HAR, minus the start of the first request of the capture. A host never
  appears before its parent (`arrivalTimes()`).
- **Timeline**: ×1 is the real time of the capture. Waits longer than
  `REPLAY_MAX_GAP` (600 ms) with nothing new (a slow server) are shortened, so
  the replay keeps a steady pace; the clock still shows the real time (the
  conversion goes both ways: `replayRealAt()` / `replayPlayedAt()`).
- **Player** (`#tree-replay-clock`, bottom of the tree area): back / forward
  1 s of the capture, play / pause (at the end it pauses; play starts again
  from the beginning), stop, the time of the capture, a bar (a click goes to
  that moment) and the speed: ×0.5, ×1, ×1.5, remembered in `localStorage`
  (`lk-tree-replay-speed`), applied at once.
- **A click on a node** during the replay (`replayGoToNode()`, instead of the
  neighbours focus) pauses at the moment it arrived: the clock shows its time,
  the host and its time are written next to the bar (`.lk-replay-node`), a mark
  shows the moment on the bar (`.lk-replay-mark`), and the node is outlined
  (`g.node.is-replay-selected`) and centred. A node is fully shown at its
  arrival time (it fades in during the `REPLAY_FADE_MS` before).
- The position is driven frame by frame (`requestAnimationFrame`,
  `renderReplay()` sets the opacity of each node and link from its arrival),
  not by D3 transitions, so it can be paused and moved. A new layout
  (`relayout()`) stops it.

The chips of the points of attention stay clear of the tree controls, whatever
their width: `setupControlsCompact()` measures the bar (`ResizeObserver`) into
`--lk-tree-controls-width`.

## Links by type & size

*Display* > *Links* (`setupLinkStyle()` / `applyLinkStyle()` in `js/tree.js`),
remembered in `localStorage` (`lk-tree-links`):

- **Plain** (default): every link the same.
- **Type & size**: the colour of a link says what the child host mostly serves
  (`linkType()`): a **redirect** (the parent answered with a redirect and the
  child is a page; dashed, flowing from the parent to the child, still with
  prefers-reduced-motion), an **iframe**, **scripts**, **styles or fonts**,
  **images**, or other. Its width grows with the bytes the child host sent
  (`size` of `/json/<uuid>/tree_stats`, square-root scale from 1.5 to 10 px).
  A legend shows under the choice in the menu.

Classes: `.lk-tree-links-meaning` on `#tree_viewport`, `path.link.link-<type>`
(`.is-forward` in the radial layout, whose paths go from parent to child).
Colours: `--lk-color-tree-link-{redirect,iframe,script,style,image}` tokens
(light and dark, `css/theme.css`).

## Heat map of the nodes

*Display* > *Colour the nodes by* (`setupHeat()` / `applyHeat()` in
`js/tree.js`), remembered in `localStorage` (`lk-tree-heat`): nothing
(default), **bytes received**, **loading time** (first start to last end of the
requests of the host), **time of the first call** (from `/json/<uuid>/tree_stats`)
or **number of URLs** (from the tree dump). Each card is tinted from the
surface to `--lk-color-tree-heat` (light and dark tokens), the highest value of
the whole capture being the hottest (square-root scale, so the small values
still show): `--lk-heat` (0% to 40%, so the text of the card stays readable; the border gets the tint too) on each `g.node`, used by a `color-mix()`
on `.lk-tree-heat g.node .node-card` (a focused card keeps its accent fill). The
scale (0 and the maximum, formatted) shows under the choices in the menu, which
scrolls when it is taller than the screen.

Each choice explains itself in the menu (`.lk-heat-item small`): what is
measured and which hosts stand out. Under the choices, a sentence says how to
read the colours (the redder, the higher, compared with the highest of the
capture). While a measure is shown, hovering a node adds its value and its
share of the highest at the top of the node info panel (`showNodeInfo()`,
`heat_max`).

### Links in the filter, hover

The legend (`tree/legend.html`) has a **Links** section: one entry per link
type (`data-key="link:<type>"`, `data-link`), with its count. The link to a
node has the type of what that host serves (`linkType()`), so `nodeHas(d,
'link:<type>')` is true for the child end; the link itself stays lit when it is
of a chosen type (`applyTreeFilter()`). It combines with the icons (Any / All)
and works in both link styles. The link entries keep their own list (never
moved to "Not in this capture"; disabled at 0).

With *Type & size*, hovering a node keeps the colours of its path to the root
and makes it glow (`path.link.is-hover-path`), the other links fade
(`#tree_viewport.is-hover-active`).

### Details of a link

Hovering a link shows its details in the tree tooltip (`showLinkInfo()` in
`js/tree.js`, `#tooltip.is-link-info`, one fact per line): parent → child host,
type of the link (`linkType()`), and for the child host the bytes received, the
time of its first call and its loading time (`/json/<uuid>/tree_stats`, loaded
on the first hover if needed) and its number of URLs. The link is outlined
(`path.link.is-link-hover`; with *Type & size* it keeps its colour and glows).
Links are thin: a wide transparent path over each one (`path.link-hit`, 14 px,
`pointer-events: stroke`) catches the pointer; `path.link` itself ignores it.

## Risk badges

A round badge at the top left corner of a card (`g.node-risk`, `RISKS` and
`riskReasons()` in `js/tree.js`) marks the hosts worth a look, from the fields
of the tree dump: **red** (`.is-danger`, a slow pulse, none with
prefers-reduced-motion) for known malicious content, a bare IP address as host
(`hostname_is_ip`) or a downloaded file; **orange** (`.is-warning`) for data
sent (POST), plain HTTP, mixed content or a redirect to a URL missing in the
capture. It shows the number of reasons (`!` for one); hovering it lists them.
Front only: what the dump does not have (age of the domain, password field in
a form) is not part of it.

## Groups by network

*Display* > *Group by network* > *By AS* (`setupGroups()` / `applyGroups()` in
`js/tree.js`, remembered in `localStorage`: `lk-tree-groups`): a coloured halo
behind each card (`rect.node-group-halo`) whose host is in one of the 6 biggest
networks (AS, from the `ipasn` of the tree dump) of the capture with at least
2 hosts. The legend under the choice lists them, with their number of hosts;
a few well-known networks are named (`KNOWN_AS`, a fixed list in the file, no
lookup). Colours: `--lk-color-tree-group-1` … `-6` (light and dark,
`css/theme.css`).

## Map of the tree

At the bottom left, next to the shortcuts button (`#tree-minimap`,
`setupMinimap()` / `drawMinimap()` in `js/tree.js`): the cards shown, in small
(the main path in the accent colour), and a frame on the part of the tree on
screen. Click or drag in it: that point goes to the middle of the tree area
(the drag of the tree itself is not started). It follows the scroll, the zoom
and every change of the tree (`refreshMinimap()`, one redraw per frame). The
map button folds it (remembered: `lk-tree-minimap`). Hidden on phones.

### Worth a look: filter and list

- **Filter**: the legend has a *Worth a look* section: *Danger* (red badge),
  *Warning* (the worst reason is orange) and *Bare IP address*
  (`risk:danger`, `risk:warning`, `hostname_is_ip`; `riskLevel()` in
  `nodeHas()`), combined with the other entries (Any / All).
- **List**: the first chip of the points of attention, *N worth a look*
  (`.lk-tree-alert-risks`, red when one is red), opens `#tree-risks`: every
  host with a badge, red first, with its reasons and its parent ("via …", two
  hosts can have the same name). A click goes to the node (`goToNode()`: its
  folded ancestors are unfolded, then `LocateNode()` centres it and makes it
  glow). The list follows the tree shown (whole capture or view from a node:
  `setupRiskList()` is called by `setupAttention()`).
