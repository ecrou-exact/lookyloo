#!/usr/bin/env python3

"""Build images/brand/lookyloo-no-pupils.png: the Lookyloo logo without the
pupils of the first two "o", for the home page where real pupils follow the
mouse (css/home.css, js/home.js). Run again if the logo changes, then
tools/generate_sri.py. Doc: doc/ui/pages/home.md
"""

from __future__ import annotations

import math

from PIL import Image

from lookyloo.default import get_homedir

BRAND = get_homedir() / 'website' / 'web' / 'static' / 'images' / 'brand'

# In pixels of lookyloo.png (706x316): centre of the ring, centre of the pupil, radius of the pupil
EYES: list[tuple[tuple[float, float], tuple[float, float], float]] = [
    ((180.0, 85.6), (191.9, 94.3), 18.5),
    ((281.2, 82.5), (292.5, 91.8), 18.5),
]
# Inside of the rings: only these pixels are erased, the ring itself is kept
RING_INNER_R = 26.5

if __name__ == '__main__':
    logo = Image.open(BRAND / 'lookyloo.png').convert('RGBA')
    px = logo.load()
    for (rx, ry), (cx, cy), r in EYES:
        for y in range(int(cy - r - 2), int(cy + r + 3)):
            for x in range(int(cx - r - 2), int(cx + r + 3)):
                if math.hypot(x - cx, y - cy) <= r and math.hypot(x - rx, y - ry) < RING_INNER_R:
                    px[x, y] = (0, 0, 0, 0)
    logo.save(BRAND / 'lookyloo-no-pupils.png', optimize=True)
    print(f'Written {BRAND / "lookyloo-no-pupils.png"}')
