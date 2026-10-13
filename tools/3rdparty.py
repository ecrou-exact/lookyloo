#!/usr/bin/env python3

"""Install the third party JS/CSS libraries of the website in website/web/static/vendor/.

By default they are downloaded from their CDN. To install without any network
access (air-gapped instance, no CDN allowed), export them once from an
installation that has them, then install from that directory:

    poetry run tools/3rdparty.py --export /path/to/lookyloo-vendor
    poetry run tools/3rdparty.py --from-dir /path/to/lookyloo-vendor

Setting LOOKYLOO_VENDOR_DIR=/path/to/lookyloo-vendor has the same effect as
--from-dir (also for `poetry run update`, which calls this script).
The exported directory contains a manifest.json (versions + SHA-256 of every
file); --from-dir refuses files whose hash does not match.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys

from pathlib import Path

import requests

from lookyloo.default import get_homedir

d3js_version = '7.9.0'
jquery_version = "3.7.1"
datatables_version = "3.1.2"
datatables_rowgroup_version = "2.1.1"
datatables_buttons_version = "4.1.2"
datatables_select_version = "4.1.1"
jquery_json_viewer_version = "1.5.0"

datatables_bundle = (f'https://cdn.datatables.net/v/bs5/dt-{datatables_version}/b-{datatables_buttons_version}'
                     f'/rg-{datatables_rowgroup_version}/sl-{datatables_select_version}')

# file name in static/vendor/ -> (description, version, source URL)
FILES: dict[str, tuple[str, str, str]] = {
    'd3.min.js': ('d3js', d3js_version, f'https://cdn.jsdelivr.net/npm/d3@{d3js_version}/dist/d3.min.js'),
    'jquery.min.js': ('jquery', jquery_version, f'https://code.jquery.com/jquery-{jquery_version}.min.js'),
    'datatables.min.js': ('datatables js', datatables_version, f'{datatables_bundle}/datatables.min.js'),
    'datatables.min.css': ('datatables css', datatables_version, f'{datatables_bundle}/datatables.min.css'),
    'jquery.json-viewer.js': ('jquery_json js', jquery_json_viewer_version,
                              f'https://cdn.jsdelivr.net/npm/jquery.json-viewer@{jquery_json_viewer_version}/json-viewer/jquery.json-viewer.js'),
    'jquery.json-viewer.css': ('jquery_json css', jquery_json_viewer_version,
                               f'https://cdn.jsdelivr.net/npm/jquery.json-viewer@{jquery_json_viewer_version}/json-viewer/jquery.json-viewer.css'),
}

MANIFEST = 'manifest.json'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(dest_dir: Path) -> None:
    for name, (description, version, url) in FILES.items():
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        (dest_dir / name).write_bytes(response.content)
        print(f'Downloaded {description} v{version}.')
    print('All 3rd party modules for the website were downloaded.')


def export(dest_dir: Path, export_dir: Path) -> None:
    export_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, str]] = {}
    for name, (description, version, url) in FILES.items():
        source = dest_dir / name
        if not source.exists():
            raise SystemExit(f'{source} is missing: run tools/3rdparty.py first.')
        shutil.copy2(source, export_dir / name)
        manifest[name] = {'description': description, 'version': version, 'source': url, 'sha256': sha256(source)}
    (export_dir / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Exported {len(manifest)} files and {MANIFEST} to {export_dir}.')


def install_from_dir(dest_dir: Path, source_dir: Path) -> None:
    manifest_path = source_dir / MANIFEST
    if not manifest_path.exists():
        raise SystemExit(f'{manifest_path} is missing: create the directory with tools/3rdparty.py --export.')
    manifest = json.loads(manifest_path.read_text())
    for name, (description, version, _) in FILES.items():
        entry = manifest.get(name)
        source = source_dir / name
        if not entry or not source.exists():
            raise SystemExit(f'{name} is missing from {source_dir}.')
        if entry.get('version') != version:
            raise SystemExit(f'{name}: version {entry.get("version")} in {source_dir}, {version} expected. Export it again.')
        if sha256(source) != entry.get('sha256'):
            raise SystemExit(f'{name}: SHA-256 mismatch with {MANIFEST}, refusing to install it.')
        shutil.copy2(source, dest_dir / name)
        print(f'Installed {description} v{version} from {source_dir}.')
    print('All 3rd party modules for the website were installed from the local directory (no network).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Install the third party JS/CSS libraries of the website.')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--from-dir', type=Path, help='Install from a directory made with --export (no network access).')
    group.add_argument('--export', type=Path, help='Copy the installed libraries and a manifest to this directory.')
    args = parser.parse_args()

    dest_dir = get_homedir() / 'website' / 'web' / 'static' / 'vendor'
    dest_dir.mkdir(parents=True, exist_ok=True)

    from_dir = args.from_dir or (Path(os.environ['LOOKYLOO_VENDOR_DIR']) if os.environ.get('LOOKYLOO_VENDOR_DIR') else None)
    if args.export:
        export(dest_dir, args.export)
    elif from_dir:
        install_from_dir(dest_dir, from_dir)
    else:
        download(dest_dir)
    sys.exit(0)
