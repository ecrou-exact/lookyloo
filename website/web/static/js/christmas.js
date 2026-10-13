"use strict";
// Decorations of the Christmas theme (css/components/christmas.css): a garland of
// softly twinkling bulbs under the site header, and a light snowfall. Added only
// while <html data-lk-theme="christmas"> (js/theme_toggle.js), removed when the
// theme changes. The snow and the twinkle are off with prefers-reduced-motion.
// Doc: doc/ui/theme.md
(() => {
    const root = document.documentElement;
    const COLORS = ['red', 'gold', 'green', 'blue'];
    const SPACING = 44;   // px between two bulbs
    const FLAKES = 36;
    let mounted = false;
    let resize_timer = null;

    function garland(width) {
        const count = Math.max(4, Math.floor(width / SPACING));
        const step = width / count;
        const element = document.createElement('div');
        element.className = 'lk-xmas-garland';
        element.setAttribute('aria-hidden', 'true');
        // The wire: one scallop per bulb
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'lk-xmas-wire');
        svg.setAttribute('viewBox', `0 0 ${width} 22`);
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M0,2 `;
        for (let i = 0; i < count; i++) {
            d += `Q${i * step + step / 2},18 ${(i + 1) * step},2 `;
        }
        path.setAttribute('d', d);
        svg.appendChild(path);
        element.appendChild(svg);
        for (let i = 0; i < count; i++) {
            const bulb = document.createElement('span');
            bulb.className = `lk-xmas-bulb lk-xmas-bulb-${COLORS[i % COLORS.length]}`;
            bulb.style.left = `${i * step + step / 2}px`;
            bulb.style.animationDelay = `${((i * 7) % 11) * 0.22}s`;
            element.appendChild(bulb);
        }
        return element;
    }

    function snow() {
        const element = document.createElement('div');
        element.className = 'lk-xmas-snow';
        element.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < FLAKES; i++) {
            const flake = document.createElement('span');
            flake.className = 'lk-xmas-flake';
            const size = 3 + (i * 37 % 5);
            flake.style.left = `${(i * 61) % 100}%`;
            flake.style.width = flake.style.height = `${size}px`;
            flake.style.animationDuration = `${12 + (i * 13 % 14)}s, ${3 + (i % 4)}s`;
            flake.style.animationDelay = `-${(i * 17) % 26}s, -${i % 5}s`;
            flake.style.opacity = `${0.45 + (i % 5) * 0.11}`;
            element.appendChild(flake);
        }
        return element;
    }

    function mount() {
        unmount();
        const header = document.querySelector('.lk-header');
        if (header) {
            header.classList.add('has-xmas-garland');
            header.appendChild(garland(header.clientWidth));
        }
        document.body.appendChild(snow());
        mounted = true;
    }

    function unmount() {
        document.querySelectorAll('.lk-xmas-garland, .lk-xmas-snow').forEach(element => element.remove());
        document.querySelector('.lk-header')?.classList.remove('has-xmas-garland');
        mounted = false;
    }

    const sync = () => (root.getAttribute('data-lk-theme') === 'christmas' ? mount() : (mounted && unmount()));

    document.addEventListener('DOMContentLoaded', () => {
        sync();
        new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-lk-theme'] });
        window.addEventListener('resize', () => {
            if (!mounted) return;
            clearTimeout(resize_timer);
            resize_timer = setTimeout(mount, 250);   // the garland follows the width
        });
    });
})();
