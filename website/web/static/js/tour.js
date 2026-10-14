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
    // Full tour (every page, one after the other): {page: index in the list} in sessionStorage
    const FULL_KEY = 'lk-tour-full';
    const session = {
        get: () => { try { return JSON.parse(sessionStorage.getItem(FULL_KEY)); } catch (e) { return null; } },
        set: (value) => { try { sessionStorage.setItem(FULL_KEY, JSON.stringify(value)); } catch (e) { /* not kept */ } },
        clear: () => { try { sessionStorage.removeItem(FULL_KEY); } catch (e) { /* nothing */ } },
    };
    function fullPages() {
        try { return JSON.parse(document.getElementById('lk-tour-full-pages')?.textContent || '[]'); } catch (e) { return []; }
    }
    // Go to page `page` of the full tour (an entry with "pick" takes the first link of the
    // current page matching it; none: the next page)
    function goToFullPage(page) {
        const pages = fullPages();
        while (page < pages.length) {
            const entry = pages[page];
            const url = entry.url || document.querySelector(entry.pick)?.getAttribute('href');
            if (url) {
                session.set({ page, stage: entry.stage || null });
                location.href = url;
                return;
            }
            page++;
        }
        session.clear();   // past the last page
    }
    function startFull() {
        stop();
        goToFullPage(0);
    }
    function stopFull() { session.clear(); }
    // Stopped by the user (the Stop button): the full tour stops too
    function quit() { stopFull(); stop(); }
    const pages_of = (full) => fullPages()[full.page] || {};

    // A step with "type": the text is typed in its element, one character at a time
    let typing = null;
    function typeInto(step) {
        clearInterval(typing);
        const field = step.type && document.querySelector(step.selector);
        if (!field) return;
        field.value = '';
        let i = 0;
        typing = setInterval(() => {
            field.value = step.type.slice(0, ++i);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            if (i >= step.type.length) clearInterval(typing);
        }, 70);
    }

    // The waiting step (loading page of the first capture): no buttons, the eyes of
    // the loader, funny messages and a clock; the page is checked every 4 seconds and
    // the tree opens as soon as it is built. The tour cannot be left meanwhile.
    const WAITING_MESSAGES = [
        'Knocking on the door of the website…',
        'Opening the page in a real browser…',
        'Writing down every request, even the tiny ones…',
        'Counting the cookies (not eating them)…',
        'Following every redirect, wherever it goes…',
        'Taking a screenshot, smile!',
        'Asking each host where it lives…',
        'Planting the tree, branch by branch…',
        'Watering the tree…',
        'Almost there, the leaves are coming…',
    ];
    let waiting = null;
    function showWaiting(step) {
        clearInterval(waiting?.messages);
        clearInterval(waiting?.clock);
        clearInterval(waiting?.check);
        card.querySelector('.lk-tour-waiting')?.remove();
        card.classList.toggle('is-waiting', Boolean(step.waiting));
        if (!step.waiting) { waiting = null; return; }
        const full = session.get();
        if (full) session.set({ page: full.page, stage: 'waiting' });
        const box = document.createElement('div');
        box.className = 'lk-tour-waiting';
        const eyes = document.querySelector('.lk-wait .lk-loader')?.cloneNode(true);
        if (eyes) box.appendChild(eyes);
        const message = document.createElement('p');
        message.className = 'lk-tour-waiting-message';
        message.setAttribute('aria-live', 'polite');
        const clock = document.createElement('p');
        clock.className = 'lk-tour-waiting-clock';
        box.append(message, clock);
        card.querySelector('.lk-tour-actions').before(box);
        const started = Date.now();
        let i = 0;
        const tick = () => {
            message.textContent = WAITING_MESSAGES[i++ % WAITING_MESSAGES.length];
        };
        tick();
        const clockTick = () => { clock.textContent = `${Math.round((Date.now() - started) / 1000)} s`; };
        clockTick();
        waiting = {
            messages: setInterval(() => { tick(); }, 2600),
            clock: setInterval(clockTick, 1000),
            check: setInterval(async () => {
                try {
                    const response = await fetch(location.href, { cache: 'no-store', credentials: 'same-origin' });
                    if ((await response.text()).includes('id="tree_js"')) location.reload();
                } catch (error) { /* next time */ }
            }, 4000),
        };
        place();
    }
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

    // Stages of the last page of the full tour: 'example' (the home page, the first
    // capture filled in), 'wait' (its loading page), 'wait-seen' (tour of the loading
    // page done, it keeps reloading), then the tree of the capture (its own tour)
    const onWaitPage = () => Boolean(document.querySelector('.lk-wait'));
    const onTreePage = () => Boolean(document.getElementById('tree_js'));

    function readSteps() {
        const example = session.get()?.stage === 'example' && document.getElementById('lk-tour-example');
        const data = example || document.getElementById('lk-tour');
        if (!data) return [];
        try { return JSON.parse(data.textContent) || []; } catch (e) { return []; }
    }

    function target(step) {
        if (!step.selector) return null;
        const element = document.querySelector(step.selector);
        if (!element) return null;
        // An entry of a menu opened by the step is hidden until the menu opens
        if (step.open) return document.querySelector(step.open) ? element : null;
        const box = element.getBoundingClientRect();
        if (!box.width && !box.height) return null;
        return element;
    }

    // Steps of this page that can be shown now (an element, or a general step without selector)
    function available() {
        return steps.filter(step => !step.selector || target(step));
    }

    // Menus (Bootstrap dropdowns) opened by the steps: open the one of the step, close the others
    let opened = null;
    function openMenu(selector) {
        if (opened && opened !== selector) {
            const previous = document.querySelector(opened);
            if (previous && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(previous).hide();
            opened = null;
        }
        // The sticky block holding the menu (its own stacking context) goes above the veil
        document.querySelectorAll('.lk-tour-raised').forEach(element => element.classList.remove('lk-tour-raised'));
        if (selector) document.querySelector(selector)?.closest('.lk-capture-top, .lk-header')?.classList.add('lk-tour-raised');
        if (!selector || !window.bootstrap) return;
        const toggle = document.querySelector(selector);
        if (!toggle) return;
        // After the click that triggered the step: Bootstrap closes menus on any click
        setTimeout(() => {
            bootstrap.Dropdown.getOrCreateInstance(toggle).show();
            requestAnimationFrame(place);
        }, 0);
        opened = selector;
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'lk-tour-overlay';
        // A click outside the card does nothing: only the Stop button ends the tour
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
        const skip = button(session.get() ? 'Stop the full tour' : 'Stop the tour', 'btn btn-sm btn-link lk-tour-skip', quit);
        skip.dataset.role = 'stop';
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
        // Esc does not stop it either (only the Stop button); it is kept from the page
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
        else if (card.classList.contains('is-waiting')) return;
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
        // Entry of an opened menu: the card goes beside the menu, at the height of the entry
        const menu = step.open ? element.closest('.dropdown-menu') : null;
        if (menu) {
            const menu_box = menu.getBoundingClientRect();
            spotlight.style.left = `${box.left - 6}px`;
            spotlight.style.top = `${box.top - 6}px`;
            spotlight.style.width = `${box.width + 12}px`;
            spotlight.style.height = `${box.height + 12}px`;
            let left = menu_box.right + margin;
            if (left + card.offsetWidth > window.innerWidth - 16) left = menu_box.left - card.offsetWidth - margin;
            const top = Math.min(Math.max(16, box.top - 16), window.innerHeight - card.offsetHeight - 16);
            card.style.left = `${Math.max(16, left)}px`;
            card.style.top = `${top}px`;
            return;
        }
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
        const full = session.get();
        if (to >= list.length) {
            stop();
            if (!full) return;
            if (full.stage === 'example') {
                // The first capture: the URL typed (whole, even if Next came fast), the button pressed
                const entry = pages_of(full);
                const field = document.querySelector('#singleCaptureField');
                if (field) field.value = entry.example;
                const submit = document.querySelector(entry.submit);
                session.set({ page: full.page, stage: 'wait' });
                if (submit?.form) submit.form.requestSubmit(submit); else session.clear();
            } else if (full.stage) {
                session.clear();   // the tree of the first capture: the end of the full tour
            } else {
                goToFullPage(full.page + 1);
            }
            return;
        }
        index = Math.max(0, to);
        const step = list[index];
        const pages = fullPages();
        card.querySelector('.lk-tour-progress').textContent = full
            ? (full.stage ? `Full tour · your first capture · ${index + 1} / ${list.length}`
                          : `Full tour · page ${full.page + 1} / ${pages.length} · ${index + 1} / ${list.length}`)
            : `Tutorial · ${index + 1} / ${list.length}`;
        card.querySelector('h2').textContent = step.title;
        card.querySelector('.lk-tour-text').textContent = step.text;
        card.querySelector('[data-role="previous"]').disabled = index === 0;
        const next_page = full && !full.stage && pages[full.page + 1];
        const last_label = full?.stage === 'example' ? `Capture ${new URL(pages[full.page].example).hostname} →`
            : next_page ? `Next page: ${next_page.label} →` : 'Finish';
        card.querySelector('[data-role="next"]').textContent = index < list.length - 1 ? 'Next' : last_label;
        openMenu(step.open);
        typeInto(step);
        showWaiting(step);
        const element = target(step);
        // Entry of an opened menu: the whole menu stays readable above the veil,
        // the entry gets its own outline (the spotlight goes under the menu)
        document.querySelectorAll('.lk-tour-target').forEach(node => node.classList.remove('lk-tour-target'));
        spotlight.classList.toggle('is-under', Boolean(step.open));
        if (step.open && element) element.classList.add('lk-tour-target');
        if (element && !step.open) {
            if (element.closest('#tree_viewport') && window.centerInViewport) {
                // In the tree: scroll the tree only (js/tree.js), never the page
                window.centerInViewport(element, false);
            } else {
                element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }
        place();
        setTimeout(place, 320);   // after a smooth scroll / a menu opening
        card.querySelector('[data-role="next"]').focus({ preventScroll: true });
    }

    function start() {
        // The page can prepare itself (e.g. an example row on an empty list, js/capture_list_demo.js)
        document.dispatchEvent(new CustomEvent('lk-tour:before-start'));
        steps = readSteps();
        if (!available().length) return;
        stop();
        build();
        document.body.classList.add('lk-tour-running');
        go(0);
        const seen = JSON.parse(storage.get(SEEN_KEY) || '{}');
        seen[document.body.dataset.lkTour || location.pathname] = true;
        storage.set(SEEN_KEY, JSON.stringify(seen));
    }

    function stop() {
        const was_running = Boolean(card);
        clearInterval(typing);
        if (waiting) { clearInterval(waiting.messages); clearInterval(waiting.clock); clearInterval(waiting.check); waiting = null; }
        openMenu(null);
        document.querySelectorAll('.lk-tour-target').forEach(node => node.classList.remove('lk-tour-target'));
        document.body.classList.remove('lk-tour-running');
        [overlay, spotlight, card].forEach(element => element?.remove());
        overlay = spotlight = card = null;
        document.removeEventListener('keydown', keys, true);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        if (was_running) document.dispatchEvent(new CustomEvent('lk-tour:stop'));
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
        // Full tour going on: the tour of this page starts at once
        const full = session.get();
        if (full?.stage) {
            if (full.stage === 'waiting' && onWaitPage()) {
                // Reloaded while the capture runs: straight back to the waiting card
                setTimeout(() => { start(); go(available().length - 1); }, 300);
                return;
            } else if (full.stage !== 'example' && !onWaitPage() && !onTreePage()) {
                session.clear();   // left the first capture for another page
                return;
            }
            if (steps.length) setTimeout(start, 300);
            return;
        }
        if (full) {
            if (steps.length) setTimeout(start, 300);
            else goToFullPage(session.get().page + 1);   // a page without a tour: the next one
            return;
        }
        const page = document.body.dataset.lkTour || location.pathname;
        const seen = JSON.parse(storage.get(SEEN_KEY) || '{}');
        if (storage.get(MODE_KEY) === 'on' && steps.length && !seen[page]) setTimeout(start, 300);
    }

    window.lkTour = { start, stop, autoStart, startFull };

    document.addEventListener('DOMContentLoaded', () => {
        steps = readSteps();
        const start_button = document.getElementById('lk-tour-start');
        if (start_button) {
            start_button.disabled = !steps.length;
            start_button.addEventListener('click', () => setTimeout(start, 50));
        }
        // Every "full tour" button (Tutorial menu, home page of an empty instance, loaded later)
        document.addEventListener('click', (event) => {
            if (event.target.closest('[data-lk-tour-full]')) setTimeout(startFull, 50);
        });
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
