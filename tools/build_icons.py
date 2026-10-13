#!/usr/bin/env python3

"""Build the SVG icon sprite used by the web interface.

The sprite (website/web/static/images/icons/sprite.svg) is committed and only
contains the icons actually used, so instances never need the icon sources.

Icon names:
    bi:<name>          Bootstrap Icons, from the sprite shipped by bootstrap-flask
    misp:<set>/<name>  MISP icons, from the misp-iconify submodule (tools/misp-iconify),
                       <set> is a folder of src/svg/ (attributes, objects, galaxies, ...)

Used icons are found by scanning templates and Python files for quoted icon names
('bi:...' / 'misp:<set>/...', in icon() calls or macro parameters such as icon_name),
plus the names listed in tools/icons_extra.txt (icons built dynamically).

Every SVG is sanitised against a whitelist (elements, attributes, local url(#id)
references only) and its internal ids are prefixed to stay unique in the sprite.

    poetry run tools/build_icons.py            # (re)build the sprite
    poetry run tools/build_icons.py --check    # exit 1 if the sprite is outdated
    poetry run tools/build_icons.py --list misp:attributes   # list available icons

Doc: doc/ui/icons.md
"""

from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET

from importlib.util import find_spec
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / 'website' / 'web'
SPRITE = WEB / 'static' / 'images' / 'icons' / 'sprite.svg'
EXTRA = ROOT / 'tools' / 'icons_extra.txt'
MISP_SRC = ROOT / 'tools' / 'misp-iconify' / 'src' / 'svg'

SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)

ICON_NAME = re.compile(r'^(bi:[a-z0-9-]+|misp:[a-z0-9-]+/[a-z0-9_-]+)$')
# Any quoted icon name: icon('bi:x') calls, but also names passed to macros
# (page_header(..., icon_name='misp:attributes/cookie'))
ICON_CALL = re.compile(r'''['"]((?:bi|misp):[a-z0-9][a-z0-9/_-]*)['"]''')

ALLOWED_TAGS = {'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
                'defs', 'mask', 'clipPath', 'linearGradient', 'radialGradient', 'stop'}
ALLOWED_ATTRS = {'d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r',
                 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'offset',
                 'fill', 'fill-rule', 'fill-opacity', 'clip-rule', 'clip-path', 'mask',
                 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
                 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'stroke-opacity',
                 'opacity', 'color', 'stop-color', 'stop-opacity',
                 'maskUnits', 'maskContentUnits', 'clipPathUnits', 'gradientUnits',
                 'gradientTransform', 'id'}
LOCAL_REF = re.compile(r'^url\(#([A-Za-z0-9_.:-]+)\)$')
VIEWBOX = re.compile(r'^-?[0-9.]+( -?[0-9.]+){3}$')


class IconError(Exception):
    pass


def symbol_id(name: str) -> str:
    '''bi:share -> bi-share, misp:attributes/domain -> misp-attributes-domain'''
    return name.replace(':', '-').replace('/', '-')


def find_used_icons() -> dict[str, set[str]]:
    '''Icon name -> files using it.'''
    used: dict[str, set[str]] = {}
    files = list((WEB / 'templates').rglob('*.html')) + list(WEB.glob('*.py'))
    for path in files:
        for name in ICON_CALL.findall(path.read_text()):
            used.setdefault(name, set()).add(str(path.relative_to(ROOT)))
    if EXTRA.exists():
        for line in EXTRA.read_text().splitlines():
            line = line.split('#', 1)[0].strip()
            if line:
                used.setdefault(line, set()).add(str(EXTRA.relative_to(ROOT)))
    for name, where in used.items():
        if not ICON_NAME.match(name):
            raise IconError(f'Invalid icon name "{name}" in {", ".join(sorted(where))}')
    return used


def bootstrap_icons_sprite() -> Path:
    spec = find_spec('flask_bootstrap')
    if not spec or not spec.origin:
        raise IconError('bootstrap-flask is not installed (poetry install).')
    return Path(spec.origin).parent / 'static' / 'bootstrap5' / 'icons' / 'bootstrap-icons.svg'


def local_name(tag: str) -> str:
    return tag.split('}', 1)[1] if tag.startswith('{') else tag


def sanitize(source: ET.Element, sid: str) -> ET.Element:
    '''Return a <symbol> holding a whitelisted copy of source (an <svg> or <symbol>).'''
    viewbox = source.get('viewBox', '').strip()
    if not VIEWBOX.match(viewbox):
        raise IconError(f'{sid}: missing or invalid viewBox "{viewbox}"')

    # ids that are actually referenced through url(#id) are kept (renamed), others dropped
    referenced = {m.group(1) for el in source.iter() for v in el.attrib.values()
                  if (m := LOCAL_REF.match(v.strip()))}
    renamed = {old: f'{sid}-{i}' for i, old in enumerate(sorted(referenced))}

    def copy(src: ET.Element, dst: ET.Element) -> None:
        for child in src:
            if not isinstance(child.tag, str) or not child.tag.startswith(f'{{{SVG_NS}}}'):
                continue  # comments, editor namespaces (sodipodi, inkscape)
            tag = local_name(child.tag)
            if tag not in ALLOWED_TAGS:
                continue
            new = ET.SubElement(dst, f'{{{SVG_NS}}}{tag}')
            for key, value in child.attrib.items():
                if key not in ALLOWED_ATTRS:
                    continue
                value = value.strip()
                if key == 'id':
                    if value in renamed:
                        new.set('id', renamed[value])
                    continue
                if 'url(' in value:
                    m = LOCAL_REF.match(value)
                    if not m or m.group(1) not in renamed:
                        raise IconError(f'{sid}: unsupported reference {key}="{value}"')
                    value = f'url(#{renamed[m.group(1)]})'
                new.set(key, value)
            copy(child, new)
            if tag == 'defs' and len(new) == 0:
                dst.remove(new)

    symbol = ET.Element(f'{{{SVG_NS}}}symbol', {'id': sid, 'viewBox': viewbox})
    # Presentation attributes on the root <svg> (fill="none"...) must be kept
    root_attrs = {k: v for k, v in source.attrib.items()
                  if k in ALLOWED_ATTRS and k not in ('id', 'width', 'height', 'x', 'y')}
    target = ET.SubElement(symbol, f'{{{SVG_NS}}}g', root_attrs) if root_attrs else symbol
    copy(source, target)
    if len(target) == 0:
        raise IconError(f'{sid}: no drawable content after sanitising')
    return symbol


def load_sources(names: set[str], existing: dict[str, ET.Element]) -> dict[str, ET.Element]:
    symbols: dict[str, ET.Element] = {}
    bi_names = {n for n in names if n.startswith('bi:')}
    if bi_names:
        bi_symbols = {s.get('id'): s for s in ET.parse(bootstrap_icons_sprite()).getroot()
                      if local_name(s.tag) == 'symbol'}
        for name in bi_names:
            if (src := bi_symbols.get(name[3:])) is None:
                raise IconError(f'Unknown Bootstrap icon "{name}" (see https://icons.getbootstrap.com/)')
            symbols[name] = sanitize(src, symbol_id(name))

    for name in names - bi_names:
        icon_set, icon = name[5:].split('/', 1)
        path = MISP_SRC / icon_set / f'{icon}.svg'
        if path.exists():
            symbols[name] = sanitize(ET.parse(path).getroot(), symbol_id(name))
        elif not MISP_SRC.exists() and symbol_id(name) in existing:
            # Submodule not checked out: keep the symbol already in the sprite
            print(f'WARNING: {name} reused from the current sprite (misp-iconify not checked out)',
                  file=sys.stderr)
            symbols[name] = existing[symbol_id(name)]
        elif not MISP_SRC.exists():
            raise IconError(f'{name} needs the MISP sources: '
                            'git submodule update --init --checkout tools/misp-iconify')
        else:
            raise IconError(f'Unknown MISP icon "{name}" ({path.relative_to(ROOT)} does not exist)')
    return symbols


def existing_symbols() -> dict[str, ET.Element]:
    if not SPRITE.exists():
        return {}
    return {s.get('id', ''): s for s in ET.parse(SPRITE).getroot() if local_name(s.tag) == 'symbol'}


def render(symbols: dict[str, ET.Element]) -> str:
    lines = ['<svg xmlns="http://www.w3.org/2000/svg">',
             '<!-- Generated by tools/build_icons.py, do not edit. Doc: doc/ui/icons.md -->']
    for name in sorted(symbols):
        lines.append(ET.tostring(symbols[name], encoding='unicode', short_empty_elements=True)
                     .replace(f' xmlns="{SVG_NS}"', ''))
    lines.append('</svg>')
    return '\n'.join(lines) + '\n'


def list_icons(prefix: str) -> None:
    if prefix == 'bi':
        ids = sorted(s.get('id', '') for s in ET.parse(bootstrap_icons_sprite()).getroot())
        print('\n'.join(f'bi:{i}' for i in ids))
    elif prefix.startswith('misp:'):
        folder = MISP_SRC / prefix[5:]
        if not folder.is_dir():
            sets = ', '.join(sorted(p.name for p in MISP_SRC.iterdir())) if MISP_SRC.exists() else 'submodule not checked out'
            raise IconError(f'Unknown MISP set "{prefix[5:]}" (available: {sets})')
        print('\n'.join(f'{prefix}/{p.stem}' for p in sorted(folder.glob('*.svg'))))
    else:
        raise IconError('--list takes "bi" or "misp:<set>"')


def main() -> int:
    parser = argparse.ArgumentParser(description='Build the SVG icon sprite of the web interface.')
    parser.add_argument('--check', action='store_true', help='Exit 1 if the sprite is not up to date.')
    parser.add_argument('--list', metavar='SET', help='List available icons: "bi" or "misp:<set>".')
    args = parser.parse_args()
    try:
        if args.list:
            list_icons(args.list)
            return 0
        used = find_used_icons()
        content = render(load_sources(set(used), existing_symbols()))
    except IconError as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 1

    current = SPRITE.read_text() if SPRITE.exists() else ''
    if args.check:
        if current != content:
            print('The icon sprite is outdated: run tools/build_icons.py then tools/generate_sri.py',
                  file=sys.stderr)
            return 1
        print(f'Icon sprite up to date ({len(used)} icons).')
        return 0
    if current != content:
        SPRITE.write_text(content)
        print(f'Icon sprite written: {len(used)} icons, {len(content.encode())} bytes. '
              'Now run tools/generate_sri.py')
    else:
        print(f'Icon sprite already up to date ({len(used)} icons).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
