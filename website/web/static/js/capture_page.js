"use strict";
// Capture page (tree/tree.html). Doc: doc/ui/pages/tree.md
// - The tree area fills the screen under the top block (site header, capture bar,
//   messages): --lk-capture-top-height is kept equal to the height of that block.
// - The capture bar can be folded to one line; the choice is remembered.
// - The tree can be dragged with the mouse to scroll it.

(() => {
    const top = document.getElementById('capture_top');
    const bar = document.getElementById('menu_vertical');
    const fold = document.getElementById('capture_fold');
    if (!top || !bar || !fold) {
        return;
    }
    const KEY = 'lk-capture-bar-folded';

    const measure = () => {
        document.documentElement.style.setProperty('--lk-capture-top-height', `${top.offsetHeight}px`);
    };
    new ResizeObserver(measure).observe(top);
    measure();

    const setFolded = (folded) => {
        bar.classList.toggle('is-folded', folded);
        fold.setAttribute('aria-expanded', folded ? 'false' : 'true');
        const label = folded ? 'Unfold the capture bar' : 'Fold the capture bar';
        fold.title = label;
        fold.querySelector('.visually-hidden').textContent = label;
    };
    let folded = false;
    try {
        folded = localStorage.getItem(KEY) === '1';
    } catch (e) { /* storage unavailable: unfolded */ }
    setFolded(folded);

    fold.addEventListener('click', () => {
        folded = !bar.classList.contains('is-folded');
        setFolded(folded);
        try {
            localStorage.setItem(KEY, folded ? '1' : '0');
        } catch (e) { /* not remembered */ }
    });
})();

// Drag the tree with the mouse: press anywhere in the tree area and move to
// scroll it (no need for the scrollbars). A press without movement stays a
// normal click (card focus, hostname pop-up, icon filter); after a drag the
// click is swallowed so nothing gets selected by accident.
// The drag goes into the free room around the tree (js/tree.js, PAN_ROOM) up to
// its edge: past it, the tree follows the mouse a little, with resistance, the
// edge glows, and it springs back when the button is released.
(() => {
    const viewport = document.getElementById('tree_viewport');
    if (!viewport) {
        return;
    }
    const THRESHOLD = 4;   // pixels before a press becomes a drag
    let start = null;
    let dragged = false;
    const area = viewport.closest('.lk-tree-area') || viewport;
    const content = document.getElementById('tree_svg');
    const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MAX_STRETCH = 70;   // pixels the tree can be pulled past the edge
    // Pulled past the edge by `over` pixels: less and less as it goes
    const stretch = (over) => Math.sign(over) * MAX_STRETCH * (1 - Math.exp(-Math.abs(over) / 180));
    const showEdge = (x, y) => {
        area.classList.toggle('is-edge-left', x > 0);
        area.classList.toggle('is-edge-right', x < 0);
        area.classList.toggle('is-edge-top', y > 0);
        area.classList.toggle('is-edge-bottom', y < 0);
        if (content && !reduce_motion) {
            content.style.transition = 'none';
            content.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
        }
    };

    viewport.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) {
            return;   // touch screens scroll natively
        }
        start = {x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop};
        dragged = false;
    });

    viewport.addEventListener('pointermove', (event) => {
        if (!start) {
            return;
        }
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!dragged && Math.hypot(dx, dy) < THRESHOLD) {
            return;
        }
        if (!dragged) {
            dragged = true;
            viewport.classList.add('is-panning');
            viewport.setPointerCapture(event.pointerId);
        }
        viewport.scrollLeft = start.left - dx;
        viewport.scrollTop = start.top - dy;
        // What the scroll could not do: the edge is reached
        const over_x = viewport.scrollLeft - (start.left - dx);
        const over_y = viewport.scrollTop - (start.top - dy);
        showEdge(Math.round(stretch(over_x)), Math.round(stretch(over_y)));
        event.preventDefault();
    });

    const stop = (event) => {
        if (!start) {
            return;
        }
        start = null;
        viewport.classList.remove('is-panning');
        // Spring back
        area.classList.remove('is-edge-left', 'is-edge-right', 'is-edge-top', 'is-edge-bottom');
        if (content && content.style.transform) {
            content.style.transition = 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            content.style.transform = '';
        }
        if (viewport.hasPointerCapture?.(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
        }
    };
    viewport.addEventListener('pointerup', stop);
    viewport.addEventListener('pointercancel', stop);

    // The click that ends a drag does nothing
    viewport.addEventListener('click', (event) => {
        if (dragged) {
            event.stopPropagation();
            event.preventDefault();
            dragged = false;
        }
    }, true);
})();

// Wheel over the tree: going down scrolls the tree, then the page (the footer
// comes into view); going up scrolls the page back first (the footer leaves the
// screen), then the tree. Without it, the footer stayed on screen while the
// tree scrolled up.
(() => {
    const viewport = document.getElementById('tree_viewport');
    if (!viewport) {
        return;
    }
    viewport.addEventListener('wheel', (event) => {
        if (event.deltaY < 0 && window.scrollY > 0 && !document.fullscreenElement) {
            event.preventDefault();
            window.scrollBy({ top: event.deltaY, behavior: 'auto' });
        }
    }, { passive: false });
})();
