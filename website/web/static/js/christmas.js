"use strict";
// Decorations of the Christmas theme (css/components/christmas.css), a winter
// night: a garland of softly twinkling bulbs under the site header, a light
// snowfall, stars and now and then a shooting star in the sky, and a band of
// snowy hills with fir trees and a small campfire right above the footer.
// Added only while <html data-lk-theme="christmas"> (js/theme_toggle.js),
// removed when the theme changes. Animations are off with prefers-reduced-motion.
// Doc: doc/ui/theme.md
(() => {
    const root = document.documentElement;
    const COLORS = ['red', 'gold', 'green', 'blue'];
    const SPACING = 44;   // px between two bulbs
    const FLAKES = 36;
    const STARS = 36;
    let mounted = false;
    let resize_timer = null;
    let shooting_timer = null;
    const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    function stars() {
        const element = document.createElement('div');
        element.className = 'lk-xmas-stars';
        element.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < STARS; i++) {
            const star = document.createElement('span');
            star.className = 'lk-xmas-star';
            star.style.left = `${(i * 53) % 100}%`;
            star.style.top = `${4 + (i * 29) % 92}%`;
            const size = i % 5 === 0 ? 2.5 : 1.5;
            star.style.width = star.style.height = `${size}px`;
            star.style.animationDuration = `${3 + (i % 4)}s`;
            star.style.animationDelay = `-${(i * 7) % 6}s`;
            element.appendChild(star);
        }
        return element;
    }

    // Now and then, a shooting star crosses the top of the sky
    function shootingStar() {
        const sky = document.querySelector('.lk-xmas-stars');
        if (sky && !document.hidden) {
            const streak = document.createElement('span');
            streak.className = 'lk-xmas-shooting-star';
            streak.style.left = `${10 + Math.random() * 60}%`;
            streak.style.top = `${4 + Math.random() * 30}%`;
            streak.addEventListener('animationend', () => streak.remove());
            sky.appendChild(streak);
        }
        shooting_timer = setTimeout(shootingStar, (10 + Math.random() * 15) * 1000);
    }

    // Snowy hills with fir trees and a small campfire, a band above the footer.
    // Seeded: the same landscape on every page. Built from our own markup only.
    function landscape() {
        let seed = 7;
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const W = 1440, H = 240;
        const hillY = (base, amp, waves, x) =>
            base - amp * (Math.sin(x / W * Math.PI * waves) * 0.6 + Math.sin(x / W * Math.PI * waves * 2.3 + 1) * 0.4);
        const hills = (base, amp, waves) => {
            let d = `M0,${H} L0,${base}`;
            for (let x = 0; x <= W; x += 40) d += ` L${x},${hillY(base, amp, waves, x).toFixed(1)}`;
            return `${d} L${W},${H} Z`;
        };
        const tree = (x, ground, h, kind) => {
            const w = h * 0.62;
            let body = '', caps = '';
            for (let t = 0; t < 3; t++) {                   // three tiers of branches
                const top = ground - h + t * h * 0.24;
                const bottom = top + h * 0.42;
                const half = w * (0.55 + t * 0.22) / 2;
                body += `M${x},${top} L${x - half},${bottom} L${x + half},${bottom} Z `;
                caps += `M${x},${top} L${x - half * 0.45},${top + h * 0.12} L${x + half * 0.45},${top + h * 0.12} Z `;
            }
            body += `M${x - w * 0.06},${ground - h * 0.1} h${w * 0.12} v${h * 0.12} h${-w * 0.12} Z`;
            return `<path class="lk-xmas-tree-${kind}" d="${body}"/><path class="lk-xmas-snowcap-${kind}" d="${caps}"/>`;
        };
        const campfire = (x, y) => {
            let g = `<g class="lk-xmas-camp" transform="translate(${x},${y}) scale(1.3)">`;
            g += '<ellipse class="lk-xmas-camp-glow" cx="0" cy="-2" rx="34" ry="12" fill="url(#lk-xmas-camp-glow)"/>';
            for (let i = 0; i < 4; i++) {
                g += `<circle class="lk-xmas-camp-smoke" style="animation-delay:${-i * 1.6}s" cx="0" cy="-12" r="3.5" fill="url(#lk-xmas-camp-smoke)"/>`;
            }
            g += '<rect class="lk-xmas-log" x="-9" y="-3" width="18" height="3" rx="1.5" transform="rotate(14)"/>';
            g += '<rect class="lk-xmas-log" x="-9" y="-3" width="18" height="3" rx="1.5" transform="rotate(-14)"/>';
            g += '<path class="lk-xmas-flame" d="M0,-16 C5,-9 6,-4 0,-2 C-6,-4 -5,-9 0,-16 Z"/>';
            g += '<path class="lk-xmas-flame lk-xmas-flame-in" d="M0,-11 C3,-7 3,-4 0,-2.5 C-3,-4 -3,-7 0,-11 Z"/>';
            return `${g}</g>`;
        };
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">`;
        // Colours of the gradients: css/components/christmas.css (--lk-xmas-* tokens)
        svg += '<defs><radialGradient id="lk-xmas-camp-glow"><stop class="lk-xmas-glow-stop" offset="0" stop-opacity="1"/><stop class="lk-xmas-glow-stop" offset="1" stop-opacity="0"/></radialGradient>'
             + '<radialGradient id="lk-xmas-camp-smoke"><stop class="lk-xmas-smoke-stop" offset="0" stop-opacity=".9"/><stop class="lk-xmas-smoke-stop" offset="1" stop-opacity="0"/></radialGradient></defs>';
        for (let i = 0; i < 18; i++) {
            svg += `<circle class="lk-xmas-sky-star" style="animation-delay:${(-rand() * 5).toFixed(2)}s" cx="${(rand() * W).toFixed(0)}" cy="${(8 + rand() * 95).toFixed(0)}" r="${rand() < 0.2 ? 1.4 : 0.8}"/>`;
        }
        svg += `<path class="lk-xmas-hills-far" d="${hills(150, 26, 3)}"/>`;
        for (let i = 0; i < 26; i++) svg += tree(rand() * W, 150 + rand() * 10, 26 + rand() * 18, 'far');
        svg += `<path class="lk-xmas-hills-near" d="${hills(196, 20, 2)}"/>`;
        for (let i = 0; i < 16; i++) svg += tree(rand() * W, 200 + rand() * 12, 44 + rand() * 30, 'near');
        const fire_x = W * 0.71;
        svg += campfire(fire_x, hillY(196, 20, 2, fire_x) + 4);
        svg += `<path class="lk-xmas-ground" d="${hills(226, 6, 4)}"/></svg>`;
        const element = document.createElement('div');
        element.className = 'lk-xmas-land';
        element.setAttribute('aria-hidden', 'true');
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
        element.appendChild(document.importNode(parsed, true));
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
        document.body.prepend(stars());
        const footer = document.querySelector('.lk-footer');
        if (footer) footer.before(landscape());
        if (!reduce_motion) shooting_timer = setTimeout(shootingStar, 4000);
        mounted = true;
    }

    function unmount() {
        clearTimeout(shooting_timer);
        document.querySelectorAll('.lk-xmas-garland, .lk-xmas-snow, .lk-xmas-stars, .lk-xmas-land')
            .forEach(element => element.remove());
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
