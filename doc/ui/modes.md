# Interface modes

The capture tree has three modes, chosen in the tree tools (first button,
sliders icon, `#lk-mode-menu`), remembered in the browser (`localStorage`,
`lk-ui-mode`). They only concern the tools added to the tree by the redesign:
the menus of the capture bar (Capture, Analysis, Actions, Download, Admin) keep
every entry in every mode. The default, **Simple**, keeps the tool simple.

| Mode | For | Shows |
|---|---|---|
| **Simple** (default) | checking a link | the tree as it was, where the link goes, the screenshot |
| **Analyst** | incident response | + risk badges and *worth a look*, filters by link and risk, compare, notes, replay, details on hover |
| **Full** | exploring | + the experimental views, still built on front-only data: radial tree, heat map, links by type & size, networks |

## By section

- **Every page but the tree, and the menus of the capture bar**: the same in
  every mode.
- **Tree tools**: Replay, Compare and Notes from Analyst; in *Display*, the
  link styles, the network groups and the heat map in Full only; the radial
  layout in Full only. The orientation button from Analyst (horizontal ⇄
vertical; + radial in Full): Simple always draws the tree from left to right.
- **Legend & filter**: the *Worth a look* and *Links* sections from Analyst.
- **Nodes**: click (path and neighbours) and double click (tree from a host)
  in every mode; the chips of the points of attention (top left), the risk
  badges and the *worth a look* chip and list from Analyst; the
  network info and the details of a link on hover from Analyst; on the card,
  Simple keeps the camera (the note and *view from here* buttons from Analyst).

## How it works

- `js/ui_mode.js`, loaded in `<head>` before the first paint, sets
  `data-lk-mode` on `<html>` and `window.lkMode` (`mode`, `atLeast(mode)`).
  Changing the mode stores it and reloads the page.
- Markup: an element marked `data-lk-min-mode="analyst"` or `"full"` is hidden
  below that mode (`css/base.css`, `display: none !important`).
- Script: `js/tree.js` asks `uiAtLeast()` before the features it draws itself
  (radial orientation, saved link style / heat map / groups, hover details);
  the card buttons are hidden by `css/tree.css`.
- Tours skip the steps whose element is hidden by the mode
  (`hiddenByMode()` in `js/tour.js`), even inside a closed menu.
- Nothing is removed from the page: IDs and panels stay (the visibility badge
  still opens its panel in Simple).
