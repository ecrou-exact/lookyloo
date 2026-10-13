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
  - **Actions**: re-capture, subsequent captures, monitoring, then *Share &
    export* (visibility, forensic acquisition, MISP push, push to another
    Lookyloo);
  - **Extras** (when enabled): categories, unbookmark all nodes, mark as known;
  - **Admin** (logged in): rebuild, Ollama report, remove capture;
  - **Report suspicious capture** button (`#report-capture-btn`, red), shown
    when `enable_mail_notification` is on in `config/generic.json`: it opens
    the e-mail notification form (`#emailModal`) sent to the owners of the
    instance; then the help link.
  On small screens the toolbar keeps only the icons.

The menu ids (`#capture-menu`, `#tools-menu`, `#actions-menu`, `#extra-menu`,
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
| `.node_data.is-bookmarked` | bookmarked node (Extras) |
| `.tree-parent-*` | "triggered from a previous capture" box above the root |
| `#tooltip` | tooltip of the tree |

The PNG export (*Get forensic acquisition* > tree) copies the computed styles
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

## Neighbours of a node

A click on a node card (`.node-card`, outside the hostname and the icons)
focuses the node: it (`.is-focused`), its parent and its children stay lit,
the other nodes and the links that don't join two lit nodes are dimmed. A pill
under the search says which node is focused. Click the card again, the
background of the tree, the pill's ✕ or press Esc to show everything. It is a
third filter, combined with the search and the icons (`isNeighbour()` in
`nodeMatches()`).

## Moving around the tree

Press anywhere in the tree with the mouse and drag to scroll it
(`js/capture_page.js`, cursor *grab* / *grabbing*): no need for the
scrollbars. A press that doesn't move (less than 4 px) stays a normal click
(card focus, hostname pop-up, icon filter, camera); the click that ends a drag
is swallowed. Touch screens keep their native scrolling.

## Scrolling to a node

Every "show this node" (search matches, bookmarks, located node, rendered
page, root after a layout change) uses `centerInViewport(element)` in
`js/tree.js`: it scrolls **only** `#tree_viewport`, never the page
(`scrollIntoView()` would also scroll the page and move the top block).
`js/tree_modals.js` uses it through `window.centerInViewport`.

## Tree controls

The buttons at the top right of the tree (`setupTreeControls()` in `js/tree.js`):

- **Orientation**: left to right (default) or top to bottom, remembered in
  `localStorage` (`lk-tree-orientation`). Every position goes through
  `nodePos()` / `nodeTransform()` (d3.tree gives `x` = breadth, `y` = depth):
  horizontal uses `[y, x]`, one column per depth; vertical uses `[x, y]`, one
  row per depth (`VERTICAL_ROW`) and one column (the widest card) per leaf.
  Links go from the right of the parent to the left of the child, or from its
  bottom to the top of the child; the expand / collapse circle follows (right
  side of the card, or middle of its bottom edge), and the favicon / thumbnail
  of the rendered node move aside (`placeNodeParts()`). The button shows the current orientation (⇄ / ⇅).
- **Collapse all**: every node but the root is collapsed (the first level stays
  visible).
- **Background** (palette): plain, dots, grid or depth columns (one band out
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
the export (`GenericAPI_misp_export`, `data-export` of the link) is fetched,
**downloaded** as `lookyloo-<uuid>.misp.json`, and shown in vitrine `<vt-json>`
(tree / raw views, search, copy path or value). *Copy* and *Download again* in
the footer. The exports embed the resources of the capture (often several MiB):
the vitrine size limit is raised to its maximum (50 MiB) on this page; a
bigger export is only downloaded, with a message.

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
