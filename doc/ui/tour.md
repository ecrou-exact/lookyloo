# Tutorial (guided tours)

For beginners: every page can explain itself, one element at a time.

## Using it

The **Tutorial** button of the site header (graduation cap) opens a menu:

- **Start the tour of this page**;
- **Full tour of Lookyloo**: every page, one after the other (section *Full
  tour* below). A tour only starts by itself during the full tour (the former
  *Tutorial mode* switch is gone).

A tour highlights an element (the rest of the page is veiled) with a card that
explains it: **Next** / **Previous** (or the arrow keys), **Stop the tour**
(only this button stops it). Steps without an element (the first one, usually)
show a centred card on a veiled and slightly blurred page.

## Adding the tour of a page

In the template (any page extending `layouts/base.html`):

```jinja
{% from 'macros/tour.html' import tour %}
…
{% block tour %}{{ tour([
  (None, 'Welcome', 'What this page is for.'),
  ('#IndexTable', 'The list', 'What you can do with it.'),
]) }}{% endblock %}
```

Each step: (CSS selector or `None`, title, text[, open]). `open` is the
selector of a dropdown toggle: the menu is opened for the step (and closed
after), the step's selector is then an entry of that menu. The whole menu stays
readable above the veil, the entry is outlined (`.lk-tour-target`) and the card
goes beside the menu: the capture page explains every entry of its Capture,
Analysis, Actions, Extras and Admin menus this way. The macro writes a
`<script type="application/json" id="lk-tour">` data block (never executed,
compatible with the CSP); `js/tour.js` reads it. **Steps whose element is not
on the page, or hidden, are skipped**: a page can list optional features (admin
only, enabled modules…). Texts are inserted with `textContent`.

Elements inside the capture tree are brought into view by scrolling the tree
only (`window.centerInViewport`, js/tree.js), never the page.

Pages whose content is built after loading set `data-lk-tour-auto="manual"`
on `<body>` and call `window.lkTour.autoStart()` once it is there: the capture
page does it when the tree is drawn (`js/tree.js`).

## Pages with a tour

Home, recent captures, new capture, search, import a capture, categories,
resources, cookies, favicons, HTTP headers hashes, API, and the capture page
(the most detailed: capture bar, search, every entry of the menus, report,
points of attention and the hosts worth a look (chip, risk badge), a host card and its tools — new capture, note, view from
here —, its icons, branches, the path to the page and the details of a link,
every tree tool — replay and its player, orientation (with the radial layout),
collapse / expand all, compare, notes, the Display menu: each background, the
link styles, the heat map —, zoom and back to the tree, full screen —, legend
with its link filter, moving around (drag, elastic edge, wheel)). The tools of the cards only show on hover:
they are visible while a tour runs.

Files: `js/tour.js`, `css/components/tour.css` (veil colour: `--lk-tour-veil`
in `css/theme.css`), `macros/tour.html`, the `tour` block of `layouts/base.html`,
the Tutorial menu in `partials/header.html`.

## Events

`js/tour.js` sends `lk-tour:before-start` on `document` before it reads the
steps (a page can add what the tour needs, e.g. the example row of the list of
captures, `js/capture_list_demo.js`), and `lk-tour:stop` when a running tour
ends.

## Full tour

*Tutorial* > *Full tour of Lookyloo* (or *Start the full tour* on the home page
of an instance without public capture, `home/latest_captures.html`) visits
every page with a tour, one after the other, from the home page: Home,
Captures, a capture (the first one of the list; skipped when there is none),
New capture, Import a capture, Search, Categories, Resources, Cookies,
Favicons, HTTP headers hashes, API.

- The list is in the Tutorial menu (`#lk-tour-full-pages`, JSON built with
  `url_for` in `partials/header.html`); an entry with `pick` takes the first
  link of the current page matching that selector.
- The position is kept in `sessionStorage` (`lk-tour-full`: `{page}`): on each
  page, `autoStart()` starts its tour at once (a page without a tour goes to the
  next one). The progress reads "Full tour · page 3 / 12 · 5 / 65"; the last
  step of a page says "Next page: <label> →" and goes there.
- Only the **Stop** button ends a tour (any tour, `quit()`): a click outside
  the card or Esc do nothing, so a tour is never closed by accident.
- **Your first capture**, after the API page: the capture form
  (`#lk-tour-example` steps of `capture/capture.html`, stage `example`). The
  step with a `type` types https://github.com in the URL field, one character
  at a time (`typeInto()`); the last button, *Capture github.com →*, presses
  *Start looking!* (the `submit` of the entry). Stage `wait`: the loading page
  (`tree/tree_wait.html`) shows its tour, then a **waiting step** (`waiting`,
  `showWaiting()`): no buttons, the eyes of the loader, funny messages every
  2.6 s and a clock; the page is fetched every 4 s and reloaded once it holds
  the tree (stage `waiting`; a manual reload goes straight back to that card).
  The loading page itself reloads with `js/tree_wait.js` (10 s, waiting while a
  tour is open; `<noscript>` meta refresh without JavaScript). On the tree, its
  own tour starts; its end ends the full tour.
- Steps in the macro: `(selector, title, text[, open[, type[, waiting]]])`.
- Any element with `data-lk-tour-full` starts it (one listener on the document,
  so a button loaded later works too).

## Example rows on empty lists

A list with no row yet gets a made-up example row while its tour runs, marked
*Example* (`.lk-tour-demo-badge`, tinted row `tr.lk-tour-demo`), removed when the
tour stops (`lk-tour:before-start` / `lk-tour:stop`). The list of captures has
its own (`js/capture_list_demo.js`); the global listings use
`js/tour_demo_rows.js` (loaded by `layouts/base.html`): the table names its
example with `data-lk-tour-demo` = `categories`, `resources`, `cookies`,
`favicons` or `hhhashes`. Rows built with DOM APIs, with the classes of the real
rows; a table with real rows is left alone.
