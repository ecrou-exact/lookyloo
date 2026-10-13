"use strict";
// Tutorial mode: a guided tour of the current page, for beginners.
// Each page lists its steps in templates (block tour of layouts/base.html, read
// from <script type="application/json" id="lk-tour">): [{selector, title, text}].
// The "Tutorial" menu of the site header starts the tour of the page, and turns
// the tutorial mode on / off: when on, the tour of a page starts by itself the
// first time the page is opened (localStorage). Steps whose element is missing
// or hidden are skipped. Doc: doc/ui/tour.md
(() => {
    const MODE_KEY = 'lk-tour-mode';
    const SEEN_KEY = 'lk-tour-seen';
    const storage = {
        get: (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set: (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* not kept */ } },
    };

    let steps = [];
    let index = 0;
    let overlay = null;
    let spotlight = null;
    let card = null;

    function readSteps() {
        const data = document.getElementById('lk-tour');
        if (!data) return [];
        try { return JSON.parse(data.textContent) || []; } catch (e) { return []; }
    }

    function target(step) {
        if (!step.selector) return null;
        const element = document.querySelector(step.selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        if (!box.width && !box.height) return null;
        return element;
    }

    // Steps of this page that can be shown now (an element, or a general step without selector)
    function available() {
        return steps.filter(step => !step.selector || target(step));
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'lk-tour-overlay';
        overlay.addEventListener('click', stop);
        spotlight = document.createElement('div');
        spotlight.className = 'lk-tour-spotlight';
        card = document.createElement('div');
        card.className = 'lk-tour-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'false');
        card.setAttribute('aria-labelledby', 'lk-tour-title');
        card.innerHTML = '';
        const progress = document.createElement('p');
        progress.className = 'lk-tour-progress';
        const title = document.createElement('h2');
        title.id = 'lk-tour-title';
        const text = document.createElement('p');
        text.className = 'lk-tour-text';
        const actions = document.createElement('div');
        actions.className = 'lk-tour-actions';
        const skip = button('Skip the tour', 'btn btn-sm btn-link lk-tour-skip', stop);
        const previous = button('Previous', 'btn btn-sm btn-outline-secondary', () => go(index - 1));
        const next = button('Next', 'btn btn-sm btn-primary', () => go(index + 1));
        previous.dataset.role = 'previous';
        next.dataset.role = 'next';
        actions.append(skip, previous, next);
        card.append(progress, title, text, actions);
        document.body.append(overlay, spotlight, card);
        document.addEventListener('keydown', keys, true);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
    }

    function button(label, classes, action) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = classes;
        element.textContent = label;
        element.addEventListener('click', action);
        return element;
    }

    function keys(event) {
        if (!card) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stop(); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
    }

    function place() {
        if (!card) return;
        const list = available();
        const step = list[index];
        const element = step && target(step);
        const margin = 12;
        // General step (no element): the whole page is veiled and blurred, the card centred
        overlay.classList.toggle('is-veiled', !element);
        if (!element) {
            spotlight.hidden = true;
            card.style.left = `${Math.max(16, (window.innerWidth - card.offsetWidth) / 2)}px`;
            card.style.top = `${Math.max(16, (window.innerHeight - card.offsetHeight) / 2)}px`;
            return;
        }
        const box = element.getBoundingClientRect();
        spotlight.hidden = false;
        spotlight.style.left = `${box.left - 6}px`;
        spotlight.style.top = `${box.top - 6}px`;
        spotlight.style.width = `${box.width + 12}px`;
        spotlight.style.height = `${box.height + 12}px`;
        // Below the element, else above, else on its side; always on screen
        let top = box.bottom + margin;
        if (top + card.offsetHeight > window.innerHeight - 16) top = box.top - card.offsetHeight - margin;
        if (top < 16) top = Math.min(window.innerHeight - card.offsetHeight - 16, Math.max(16, box.top));
        let left = box.left;
        if (box.bottom + margin + card.offsetHeight > window.innerHeight - 16 && box.top - card.offsetHeight - margin < 16) {
            left = box.right + margin;
            if (left + card.offsetWidth > window.innerWidth - 16) left = box.left - card.offsetWidth - margin;
        }
        left = Math.min(Math.max(16, left), window.innerWidth - card.offsetWidth - 16);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }

    function go(to) {
        const list = available();
        if (to >= list.length) { stop(); return; }
        index = Math.max(0, to);
        const step = list[index];
        card.querySelector('.lk-tour-progress').textContent = `Tutorial · ${index + 1} / ${list.length}`;
        card.querySelector('h2').textContent = step.title;
        card.querySelector('.lk-tour-text').textContent = step.text;
        card.querySelector('[data-role="previous"]').disabled = index === 0;
        card.querySelector('[data-role="next"]').textContent = index === list.length - 1 ? 'Finish' : 'Next';
        const element = target(step);
        if (element) {
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        place();
        card.querySelector('[data-role="next"]').focus({ preventScroll: true });
    }

    function start() {
        steps = readSteps();
        if (!available().length) return;
        stop();
        build();
        go(0);
        const seen = JSON.parse(storage.get(SEEN_KEY) || '{}');
        seen[document.body.dataset.lkTour || location.pathname] = true;
        storage.set(SEEN_KEY, JSON.stringify(seen));
    }

    function stop() {
        [overlay, spotlight, card].forEach(element => element?.remove());
        overlay = spotlight = card = null;
        document.removeEventListener('keydown', keys, true);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
    }

    function showMode() {
        const on = storage.get(MODE_KEY) === 'on';
        const toggle = document.getElementById('lk-tour-mode');
        if (toggle) toggle.checked = on;
        document.getElementById('lk-tour-menu-btn')?.classList.toggle('is-on', on);
        return on;
    }

    // Tutorial mode on and this page not seen yet: start its tour
    function autoStart() {
        steps = readSteps();
        const page = document.body.dataset.lkTour || location.pathname;
        const seen = JSON.parse(storage.get(SEEN_KEY) || '{}');
        if (storage.get(MODE_KEY) === 'on' && steps.length && !seen[page]) setTimeout(start, 300);
    }

    window.lkTour = { start, stop, autoStart };

    document.addEventListener('DOMContentLoaded', () => {
        steps = readSteps();
        const start_button = document.getElementById('lk-tour-start');
        if (start_button) {
            start_button.disabled = !steps.length;
            start_button.addEventListener('click', () => setTimeout(start, 50));
        }
        document.getElementById('lk-tour-mode')?.addEventListener('change', (event) => {
            storage.set(MODE_KEY, event.target.checked ? 'on' : 'off');
            showMode();
            if (event.target.checked) setTimeout(start, 50);
        });
        // Tutorial mode: the tour of a page starts by itself the first time.
        // Pages that build their content later (the tree: data-lk-tour-auto="manual"
        // on <body>) call window.lkTour.autoStart() once it is there.
        showMode();
        if (document.body.dataset.lkTourAuto !== 'manual') setTimeout(autoStart, 300);
    });
})();
