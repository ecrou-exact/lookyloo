# Tags (categories)

`category_tag(category, link=True)` (Jinja global and Python helper in
`website/web/__init__.py`) renders a category of the MISP
`content-classification` taxonomy as a coloured pill:

```
content-classification:cybercrime="phishing"   ->   [bug] cybercrime · phishing   (red)
```

- The family (taxonomy predicate) gives the tint and the icon (`CATEGORY_FAMILIES`):
  general = blue / newspaper, technology and technical-services = teal,
  cybersecurity = green / shield, cybercrime and illegal-markets = red,
  markets and finance = amber, communities = pink, digital-content and
  geopolitics-and-hacktivism = violet. Anything else: slate with a tag icon.
- The full machine tag stays in the `title` (tooltip).
- `link=True`: links to the captures of that category (`index?category=...`).

CSS: `css/components/tag.css` (`.lk-tag` + `.lk-tag-<tint>`); the tints are the
`--lk-tag-*` / `--lk-tag-*-bg` tokens of `theme.css` (light and dark).

Used on the Categories page (`categoriesTable`, rows built by `post_table()`,
columns: tag, full machine tag (`machinetag`), number of captures)
and in the category filter chip of the Recent captures page.

To add a family: add it to `CATEGORY_FAMILIES` (an existing tint or a new
`--lk-tag-<tint>` token pair + `.lk-tag-<tint>` rule), then run
`tools/build_icons.py` and `tools/generate_sri.py`.

## On the capture lists and in the tree

- Each capture row (Recent captures and latest captures on the home page,
  `index_row()` / `index_capture_template`) shows its categories as tags under
  the facts. They come from the per-capture index
  (`Indexing.get_capture_categories()`: one Redis SMEMBERS, no disk access), only
  when `enable_categorization` is set.
- The categories modal of the capture tree (`tree/modals/categories_view.html`)
  shows the attached categories as tags.

## Verdict pill

`capture_verdict(categories)` derives a verdict from the categories: a capture
with a category of the `cybercrime` or `illegal-markets` family
(`MALICIOUS_FAMILIES`) is **malicious** and gets a red "Malicious" pill next to
its title (`.lk-verdict-malicious`, `css/components/capture-list.css`).
Otherwise no pill: Lookyloo has no other verdict source yet, and "safe" is never
claimed. A future verdict (third-party modules, analyst decision) only has to
change `capture_verdict()` and add `.lk-verdict-*` styles.
