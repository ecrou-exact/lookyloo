# No CDN: running and installing without external resources

## At runtime

Nothing is loaded from outside: Bootstrap is served by Bootstrap-Flask
(`BOOTSTRAP_SERVE_LOCAL = True`), the fonts (`static/fonts/`) and the icon
sprite (`static/images/icons/sprite.svg`) are in the repository, and the
third-party JS/CSS are in `static/vendor/`. The Content Security Policy
(`default-src 'self'`) blocks any external resource anyway.

## At installation

`tools/3rdparty.py` (also run by `poetry run update`) fills
`static/vendor/` (git-ignored) with jQuery, DataTables, D3 and
jquery.json-viewer. By default it downloads them from their CDN. To install
without any network access:

```bash
# on a machine that has them (once, or after a version bump)
poetry run tools/3rdparty.py --export /path/to/lookyloo-vendor

# on the offline instance
poetry run tools/3rdparty.py --from-dir /path/to/lookyloo-vendor
# or, also for `poetry run update`:
export LOOKYLOO_VENDOR_DIR=/path/to/lookyloo-vendor
```

The exported directory holds the files and a `manifest.json` (version, source
URL, SHA-256 of each file). `--from-dir` refuses a file whose version differs
from the one expected by `3rdparty.py` or whose hash does not match. After
installing, regenerate the SRI hashes (`poetry run tools/generate_sri.py`,
also done by `update`).
