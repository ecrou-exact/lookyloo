# Statistics (admin)

Route `statsfull` (`/stats`, login required), template `admin/stats.html`,
data from `Lookyloo.get_stats()`.

## Layout

- **This week**: four cards (captures, redirects, unique URLs, unique domains)
  for the current week, with the difference with the week before
  (`.lk-stats-card`, `.lk-stats-card-delta.is-up` / `.is-down`).
- **One section per year**, newest first: a bar chart of the captures per month
  (`.lk-stats-chart`), and the table of the months (captures, redirects, unique
  URLs and domains; `—` for the months that only have archived captures, which
  count as captures only), with a total row.

## Chart

`js/stats_graph.js` draws one D3 bar chart per `.lk-stats-chart`, from the data
in the page (`data-months`, `data-month-numbers`: no request), on the twelve
months of the year; the hover title gives the number of captures. The colours
come from `css/stats.css` (`--lk-*` tokens, light and dark).

On arrival on the page, the bars grow from the axis one month after the other,
their labels fade in, and the numbers of the cards count up to their value
(`data-value`). Nothing moves with `prefers-reduced-motion`, nor when the
charts are drawn again after a resize of the window.

### Bars or curve

**Chart: Bars / Curve** above the charts switches every chart (remembered in
`localStorage`, `lk-stats-mode`). The curve (`drawCurve`) is a smooth line
(`d3.curveMonotoneX`) through the months, with the area under it and a dot per
month; on arrival (and when switching) the line draws itself from left to
right, then the area, the dots and the values appear. In the current year, the
months still to come have no bar and no point.
