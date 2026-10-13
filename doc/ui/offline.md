# No CDN: running and installing without external resources

## At runtime

Nothing is loaded from outside: Bootstrap is served by Bootstrap-Flask
(`BOOTSTRAP_SERVE_LOCAL = True`) and every other third-party resource is in
`static/vendor/`: JS/CSS libraries, fonts (`vendor/fonts/`) and the icon sprite
(`vendor/icons/sprite.svg`). **No third-party file is committed**: `static/vendor/`
is git-ignored and filled by `tools/3rdparty.py`. The Content Security Policy
(`default-src 'self'`) blocks any external resource anyway.

## At installation

`tools/3rdparty.py` (also run by `poetry run update`) fills
`static/vendor/` (git-ignored): jQuery, DataTables, D3 and jquery.json-viewer
from their CDN, the Geist fonts from npm (integrity checked), the MISP icons
from GitHub (pinned commit), then builds the icon sprite. To install
without any network access:

```bash
# on a machine that has them (once, or after a version bump)
poetry run tools/3rdparty.py --export /path/to/lookyloo-vendor

# on the offline instance
poetry run tools/3rdparty.py --from-dir /path/to/lookyloo-vendor
# or, also for `poetry run update`:
export LOOKYLOO_VENDOR_DIR=/path/to/lookyloo-vendor
```

The exported directory holds the libraries, `fonts/`, `icons/misp/` and a
`manifest.json` (version, source URL, SHA-256 of each file); the sprite is
rebuilt from it without network. `--from-dir` refuses a file whose version differs
from the one expected by `3rdparty.py` or whose hash does not match. After
installing, regenerate the SRI hashes (`poetry run tools/generate_sri.py`,
also done by `update`).
