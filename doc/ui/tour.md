# Tutorial mode (guided tours)

For beginners: every page can explain itself, one element at a time.

## Using it

The **Tutorial** button of the site header (graduation cap) opens a menu:

- **Start the tour of this page**;
- **Tutorial mode** (switch): when on, the tour of a page starts by itself the
  first time the page is opened (then not again; kept in this browser).

A tour highlights an element (the rest of the page is veiled) with a card that
explains it: **Next** / **Previous** (or the arrow keys), **Skip the tour** (or
Esc, or a click outside). Steps without an element (the first one, usually)
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
points of attention, a host card and its tools — new capture, note, view from
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
