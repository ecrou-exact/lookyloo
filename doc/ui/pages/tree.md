# Capture page (`/tree/<uuid>`)

Template `tree/tree.html`, CSS `css/tree.css`, JS `js/tree.js` (D3 tree) and
`js/tree_modals.js` (modals, menu actions).

## Layout

The page fills the window and does not scroll as a whole (`body.lk-capture-page`):

```
site header (partials/header.html)
capture bar  (.lk-capture-bar)       what was captured + actions
messages     (.lk-capture-flashes)   flash messages, dismissible
tree         (#tree_viewport)        scrolls in both directions, holds #tree_svg
legend       (tree/legend.html)      <details> at the bottom right, closed
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
