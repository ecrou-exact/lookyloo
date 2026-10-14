#!/usr/bin/env python3

"""Install the third party resources of the website in website/web/static/vendor/
(git-ignored: no third-party file is committed in the repository):

- JS/CSS libraries (jQuery, DataTables, D3, jquery.json-viewer), from their CDN;
- the Geist fonts (npm package "geist", integrity checked) in vendor/fonts/geist/;
- the icon sprite vendor/icons/sprite.svg, built by tools/build_icons.py from
  Bootstrap Icons (bootstrap-flask) and misp-iconify (fetched from GitHub at a
  pinned commit, cached in vendor/icons/misp/);
- Vitrine (https://github.com/ecrou-exact/vitrine, web components: the Markdown
  editor of the notes of the capture page) in vendor/vitrine/: source of a
  pinned commit, SHA-256 checked, built with Node >= 20 (`npm ci --ignore-scripts`
  + `node scripts/build.js`). Without Node, install it from an export (below).

By default everything is downloaded. To install without any network
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
import base64
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile

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

# Geist fonts: npm tarball, its sha512 integrity (npm registry) and the files we keep
geist_version = '1.7.2'
GEIST_TARBALL = f'https://registry.npmjs.org/geist/-/geist-{geist_version}.tgz'
GEIST_INTEGRITY = 'sha512-Gu5lDFa3pLRyoBlBPf0QIFHVdWAnpco7fS1bJm41jyLPFoguBgiubseUN2oLXMgqZ7uxAxDoXcHMhCY/fOTTgg=='
GEIST_FILES = {'package/dist/fonts/geist-sans/Geist-Variable.woff2': 'Geist-Variable.woff2',
               'package/dist/fonts/geist-mono/GeistMono-Variable.woff2': 'GeistMono-Variable.woff2',
               'package/LICENSE.txt': 'OFL.txt'}
# Vitrine: source tarball of a pinned commit, built with Node
VITRINE_COMMIT = 'cbbec10d7673434b5f7564f22ae41605fde09520'
VITRINE_TARBALL = f'https://codeload.github.com/ecrou-exact/vitrine/tar.gz/{VITRINE_COMMIT}'
VITRINE_SHA256 = '2428ff217494daaff19965defbd85be48cd94399f60e49a74266fa2d6bed346b'
# What the website needs from vitrine's dist/
VITRINE_KEEP = ('esm', 'languages', 'syntax-themes', 'vendor', 'vitrine.css')

# Sub-directories of vendor/ handled as a whole by --export / --from-dir
VENDOR_DIRS = ('fonts', 'icons/misp', 'vitrine')


def download_fonts(dest_dir: Path) -> None:
    response = requests.get(GEIST_TARBALL, timeout=60)
    response.raise_for_status()
    digest = 'sha512-' + base64.b64encode(hashlib.sha512(response.content).digest()).decode()
    if digest != GEIST_INTEGRITY:
        raise SystemExit(f'Geist {geist_version}: integrity mismatch, refusing to install it.')
    fonts_dir = dest_dir / 'fonts' / 'geist'
    fonts_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(response.content), mode='r:gz') as tar:
        for member, target in GEIST_FILES.items():
            extracted = tar.extractfile(member)
            if extracted is None:
                raise SystemExit(f'{member} missing from the geist package.')
            (fonts_dir / target).write_bytes(extracted.read())
    print(f'Downloaded the Geist fonts v{geist_version}.')


def install_vitrine(dest_dir: Path) -> None:
    '''Build vitrine at VITRINE_COMMIT and keep its ES modules in vendor/vitrine/.'''
    if not shutil.which('node') or not shutil.which('npm'):
        raise SystemExit('Vitrine is built with Node >= 20 (node and npm not found). Install Node, '
                         'or install the vendor files from an export (--from-dir, see doc/ui/offline.md).')
    response = requests.get(VITRINE_TARBALL, timeout=120)
    response.raise_for_status()
    if hashlib.sha256(response.content).hexdigest() != VITRINE_SHA256:
        raise SystemExit(f'Vitrine {VITRINE_COMMIT[:10]}: SHA-256 mismatch, refusing to build it.')
    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(fileobj=io.BytesIO(response.content), mode='r:gz') as tar:
            tar.extractall(tmp, filter='data')
        source = Path(tmp) / f'vitrine-{VITRINE_COMMIT}'
        subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=source, check=True)
        subprocess.run(['node', 'scripts/build.js'], cwd=source, check=True)
        target = dest_dir / 'vitrine'
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)
        for name in VITRINE_KEEP:
            built = source / 'dist' / name
            if built.is_dir():
                shutil.copytree(built, target / name, ignore=shutil.ignore_patterns('*.map'))
            elif built.exists():
                shutil.copy2(built, target / name)
        (target / 'COMMIT').write_text(VITRINE_COMMIT + '\n')
    print(f'Built vitrine {VITRINE_COMMIT[:10]}.')


def build_icon_sprite() -> None:
    '''Icon sprite of the icons used by the templates (tools/build_icons.py).'''
    subprocess.run([sys.executable, str(Path(__file__).parent / 'build_icons.py')], check=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(dest_dir: Path) -> None:
    for name, (description, version, url) in FILES.items():
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        (dest_dir / name).write_bytes(response.content)
        print(f'Downloaded {description} v{version}.')
    download_fonts(dest_dir)
    install_vitrine(dest_dir)
    build_icon_sprite()
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
    for sub in VENDOR_DIRS:
        for source in sorted((dest_dir / sub).rglob('*')):
            if source.is_file():
                rel = source.relative_to(dest_dir).as_posix()
                (export_dir / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, export_dir / rel)
                manifest[rel] = {'sha256': sha256(source)}
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
    # Fonts and MISP icons (any path under VENDOR_DIRS listed in the manifest)
    for rel, entry in manifest.items():
        if not rel.startswith(tuple(f'{d}/' for d in VENDOR_DIRS)):
            continue
        source = source_dir / rel
        if not source.exists() or sha256(source) != entry.get('sha256'):
            raise SystemExit(f'{rel}: missing or SHA-256 mismatch with {MANIFEST}, refusing to install it.')
        (dest_dir / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest_dir / rel)
    print('Installed the fonts, MISP icons and vitrine from the local directory.')
    # Built from the local copies: no network needed (unless a template uses a new MISP icon)
    build_icon_sprite()
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
