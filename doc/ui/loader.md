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

## Where it is used

| Place | Notes |
|-------|-------|
| Capture tree, while the tree loads (`tree/tree.html`) | Wrapper `#tree-loading` (hidden by `js/tree.js` when the tree is drawn); its `alt="Tree loading spinner"` is used by the Playwright tests |
| Ongoing capture page (`tree/tree_wait.html`) | Shown while a capture is queued or running; the page refreshes every 10 seconds |
