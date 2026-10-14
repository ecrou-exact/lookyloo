"use strict";
// Side panel of the capture page (templates/tree/tree.html, #lk-side-panel).
//
// The panels of the menus (Details, Capture, Analysis, Actions, Extras) are still
// defined as Bootstrap modals (remote_modal() in macros/modals.html, or written in
// tree.html), so their IDs, data-remote and listeners stay the same. A click on a
// link that opens one of them (data-bs-toggle="modal") is taken over here: the
// modal is moved into the panel, at the right of the tree, and shown there; the
// tree stays visible and usable. The "show.bs.modal" event Bootstrap would send
// is sent by this file (with the link as relatedTarget), so the loaders keep
// working (js/tree_modals.js, js/capture_components.js).
//
// A link inside a panel opens the next one on top: "Back" comes back to the
// previous one. Width: dragged with the left edge, remembered (localStorage).
// Doc: doc/ui/pages/tree.md, "Side panel".
(() => {
    const panel = document.getElementById('lk-side-panel');
    if (!panel) return;
    const area = panel.closest('.lk-tree-area');
    const stack_slot = panel.querySelector('.lk-side-panel-stack');
    const back = document.getElementById('lk-side-panel-back');
    const back_label = document.getElementById('lk-side-panel-back-label');
    const wide = document.getElementById('lk-side-panel-wide');
    // Real dialogs, kept as modals: the note editor
    const KEPT_AS_MODALS = new Set(['noteModal']);
    const WIDTH_KEY = 'lk-side-panel-width';
    const MIN_WIDTH = 360;
    const storage = {
        get: (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set: (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* not kept */ } },
    };

    // [{modal, opener}], the last one is shown
    const history = [];

    const titleOf = (modal) => modal.querySelector('.modal-title')?.textContent.trim() || 'Back';

    const setWidth = (width) => {
        const max = Math.max(MIN_WIDTH, area.clientWidth - 120);
        const value = Math.min(Math.max(width, MIN_WIDTH), max);
        area.style.setProperty('--lk-side-panel-width', `${value}px`);
        return value;
    };
    const savedWidth = parseInt(storage.get(WIDTH_KEY), 10);
    setWidth(Number.isFinite(savedWidth) ? savedWidth : Math.round(area.clientWidth * 0.42));

    const closeDropdowns = () => {
        document.querySelectorAll('[data-bs-toggle="dropdown"].show').forEach(toggle => {
            bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
        });
    };

    const display = () => {
        const current = history[history.length - 1];
        stack_slot.querySelectorAll(':scope > .modal').forEach(modal => { modal.hidden = modal !== current?.modal; });
        const previous = history[history.length - 2];
        back.hidden = !previous;
        if (previous) back_label.textContent = titleOf(previous.modal);
        panel.setAttribute('aria-labelledby', current?.modal.querySelector('.modal-title')?.id || '');
    };

    // What Bootstrap would send: the loaders listen to it on the modal
    const announce = (modal, opener) => {
        const event = new Event('show.bs.modal', { cancelable: true });
        event.relatedTarget = opener || null;
        modal.dispatchEvent(event);
        const shown = new Event('shown.bs.modal');
        shown.relatedTarget = opener || null;
        modal.dispatchEvent(shown);
    };

    function open(modal_id, opener, { replace = false } = {}) {
        const modal = document.getElementById(modal_id);
        if (!modal) return;
        closeDropdowns();
        if (modal.parentElement !== stack_slot) stack_slot.appendChild(modal);
        // A panel already in the history, opened again: back to it, with the new content
        const index = history.findIndex(entry => entry.modal === modal);
        if (index !== -1) history.splice(index);
        if (replace) history.pop();
        history.push({ modal, opener });
        announce(modal, opener);
        display();
        if (panel.hidden) {
            panel.hidden = false;
            area.classList.add('has-side-panel');
        }
        modal.querySelector('.modal-body')?.scrollTo(0, 0);
        panel.focus({ preventScroll: true });
    }

    function goBack() {
        if (history.length < 2) return;
        history.pop();
        const current = history[history.length - 1];
        // Remote content: loaded again (the modal may have been reused since)
        if (current.modal.hasAttribute('data-lk-remote-modal')) announce(current.modal, current.opener);
        display();
    }

    function close() {
        if (panel.hidden) return;
        history.forEach(entry => entry.modal.dispatchEvent(new Event('hidden.bs.modal')));
        history.length = 0;
        panel.hidden = true;
        area.classList.remove('has-side-panel');
        display();
    }

    // Links that open a modal: the panel instead. On window, capture phase: Bootstrap's
    // delegated listeners are on document in the capture phase too, this one runs first.
    window.addEventListener('click', (event) => {
        const opener = event.target.closest('[data-bs-toggle="modal"]');
        if (!opener) return;
        const target = (opener.dataset.bsTarget || opener.getAttribute('href') || '').replace(/^#/, '');
        const modal = target && document.getElementById(target);
        if (!modal || !modal.classList.contains('modal') || KEPT_AS_MODALS.has(target)) return;
        event.preventDefault();
        event.stopPropagation();
        // From the menus: a new history; from inside the panel: on top of it
        if (!panel.contains(opener)) history.length = 0;
        open(target, opener);
    }, true);

    // Close buttons of the modals, and of the panel
    panel.addEventListener('click', (event) => {
        if (event.target.closest('[data-bs-dismiss="modal"], #lk-side-panel-close')) {
            event.preventDefault();
            event.stopPropagation();
            close();
        }
    }, true);
    back.addEventListener('click', goBack);
    window.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || panel.hidden || document.querySelector('.modal.show')) return;
        event.stopImmediatePropagation();
        close();
    }, true);

    // Wide: most of the tree area, or the width chosen
    wide.addEventListener('click', () => {
        const on = panel.classList.toggle('is-wide');
        wide.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    // Width: drag the left edge
    const handle = panel.querySelector('.lk-side-panel-resize');
    handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        panel.classList.remove('is-wide');
        wide.setAttribute('aria-pressed', 'false');
        handle.setPointerCapture(event.pointerId);
        panel.classList.add('is-resizing');
        const right = area.getBoundingClientRect().right;
        const move = (e) => setWidth(right - e.clientX);
        const stop = (e) => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', stop);
            panel.classList.remove('is-resizing');
            storage.set(WIDTH_KEY, String(setWidth(right - e.clientX)));
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
    });
    handle.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 80 : 20;
        const current = panel.getBoundingClientRect().width;
        if (event.key === 'ArrowLeft') storage.set(WIDTH_KEY, String(setWidth(current + step)));
        else if (event.key === 'ArrowRight') storage.set(WIDTH_KEY, String(setWidth(current - step)));
        else return;
        event.preventDefault();
    });

    window.lkSidePanel = { open, close, back: goBack };
})();
