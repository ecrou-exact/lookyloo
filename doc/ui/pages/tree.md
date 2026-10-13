# Capture page (`/tree/<uuid>`)

Template `tree/tree.html`, CSS `css/tree.css`, JS `js/tree.js` (D3 tree) and
`js/tree_modals.js` (modals, menu actions).

## Layout

The page fills the window and does not scroll as a whole (`body.lk-capture-page`):

```
site header (partials/header.html)
capture bar  (.lk-capture-bar)       what was captured + actions
messages     (.lk-capture-flashes)   flash messages, dismissible
tree area    (.lk-tree-area)
  tree       (#tree_viewport)        scrolls in both directions, holds #tree_svg
  legend     (tree/legend.html)      legend & icon filter, over the bottom right corner, closed
footer       (partials/footer.html)  the site footer, as on every page
modals       (block content)
```

## Capture bar

- **Identity**: thumbnail of the screenshot (opens `#screenshotModal`),
  favicon and title of the page, captured URL (with copy button), capture time
  (relative, absolute on hover), number of redirects, *Private* flag,
  *Malicious* flag (`capture_verdict()` on the categories) and the category
  tags (`category_tag()`).
- **Toolbar** (`.lk-capture-toolbar`): *Details* button, then menus with an
  icon per entry (macros `menu_item` / `menu_link` at the top of `tree.html`):
  - **Capture**: details, statistics, storage state, console messages,
    downloads, video, screenshot, MISP export;
  - **Analysis**: index capture (when not indexed), *Third parties*
    (third party reports, MISP lookup, historical lookups, Hashlookup) and
    *In this capture* (resources, IPs, hostnames, URLs, favicons, hashes types,
    other identifiers);
  - **Actions**: re-capture, subsequent captures, monitoring, then *Share &
    export* (visibility, forensic acquisition, MISP push, push to another
    Lookyloo);
  - **Extras** (when enabled): categories, unbookmark all nodes, mark as known;
  - **Admin** (logged in): rebuild, Ollama report, remove capture;
  - **Report** button (when mail notifications are enabled), help link.
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
| `.tree-stripe` | every other depth column in the background |
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
The "node located" arrow uses the `--lk-color-ink` / `--lk-color-danger` colours.

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
