# Loader (Lookyloo eyes)

Loading indicator drawn like the eyes of the Lookyloo logo: two broken rings
(three arcs, like the logo's "o") with pupils that look around, rings that turn
in opposite directions and an occasional blink.

- Macro: `templates/macros/loader.html` → `loader()`
- CSS: `static/css/components/loader.css` (loaded on every page by `base.html`)

## Usage

```jinja
{% from 'macros/loader.html' import loader %}

{{ loader('Loading the capture tree') }}                      {# label for screen readers only #}
{{ loader('Capture in progress', size='lg', show_label=True) }}  {# label shown under the eyes #}
```

| Parameter | Default | Effect |
|-----------|---------|--------|
| `label` | `'Loading'` | Text announced by screen readers (`role="status"`) |
| `size` | `'md'` | `sm` (40px wide), `md` (72px), `lg` (128px) |
| `show_label` | `False` | Display the label under the eyes |

The eyes use `currentColor`: they follow the text colour (ink in light mode,
light grey in dark mode); set `color` on a parent to change it.

The markup is plain SVG + CSS animations (no JavaScript, no external image),
so it can also be inserted by JS. With `prefers-reduced-motion: reduce` the
animations are disabled and the eyes stay still.

## In JavaScript (`js/loader.js`, loaded on every page)

```js
element.innerHTML = lkLoader('Loading the statistics', 'md', true);  // label escaped
```

`lkLoader(label = 'Loading', size = 'md', showLabel = false)` returns the same
markup as the macro (keep both in sync).

**Forms**: add `data-lk-loading="Label"` to a `<form>`; on submit its button
shows the eyes with the label and is disabled (restored if the page comes back
from the browser cache with the Back button). Used by the capture forms (home,
full form, takedown) and the upload form.

**Demo delay**: add `?loader_demo=<seconds>` (max 10) to a URL to delay the
asynchronous loads of that page (home latest captures, tree modals) and see the
loaders. It only runs in the visitor's browser (`lkLoaderDemoDelay()`), the
server is never slowed down. Example: `http://127.0.0.1:5100/?loader_demo=3`.

## Where it is used

| Place | Notes |
|-------|-------|
| Capture tree, while the tree loads (`tree/tree.html`) | Wrapper `#tree-loading` (hidden by `js/tree.js` when the tree is drawn); its `alt="Tree loading spinner"` is used by the Playwright tests |
| Ongoing capture page (`tree/tree_wait.html`) | Shown while a capture is queued or running; the page refreshes every 10 seconds |
| Latest captures on the home page (`js/home.js`) | Shown until the `/home/latest` fragment arrives |
| Every modal of the capture tree and of the hostname popup (`js/tree_modals.js`, `js/hostnode_modals.js`) | Set each time a modal opens, so a reopened modal never shows its previous content; the static placeholders in `tree/tree.html` use the macro too |
| Module reload (tree), bulk captures status | `lkLoader()` instead of "please wait" texts |
| Submit buttons of the capture / upload forms | `data-lk-loading` |
| Every DataTable while it loads data | `js/render_tables.js` sets `DataTable.defaults.language.processing` to the same markup (constant `LK_LOADER_MARKUP`, keep it in sync with the macro); `loader.css` hides DataTables' default dots and styles the box |
