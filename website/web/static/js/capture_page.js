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
(() => {
    const viewport = document.getElementById('tree_viewport');
    if (!viewport) {
        return;
    }
    const THRESHOLD = 4;   // pixels before a press becomes a drag
    let start = null;
    let dragged = false;

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
        event.preventDefault();
    });

    const stop = (event) => {
        if (!start) {
            return;
        }
        start = null;
        viewport.classList.remove('is-panning');
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
