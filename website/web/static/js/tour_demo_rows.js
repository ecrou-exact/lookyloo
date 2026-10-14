"use strict";
// Tutorial of the global listings (explore/*.html): a table with no row yet gets a
// made-up example row (marked "Example") while the tour runs, so the tour can show
// what a row looks like; it is removed when the tour ends (js/tour.js events).
// The table says which example it wants: data-lk-tour-demo="<kind>". Built with DOM
// APIs, with the classes of the real rows. The list of captures has its own
// (js/capture_list_demo.js). Doc: doc/ui/tour.md
(() => {
    const DEMO_CLASS = 'lk-tour-demo';
    const el = (tag, attrs = {}, ...children) => {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        children.forEach(child => node.append(child));
        return node;
    };
    const badge = () => el('span', { class: 'lk-tour-demo-badge' }, 'Example');
    // Icons of the tree, next to this script in static/ (js/ -> images/icons/)
    const script_url = document.currentScript?.src || location.href;
    const icon_url = (name) => new URL(`../images/icons/${name}`, script_url).href;
    const HASH = 'e3b5a1c49f0d2b7c';

    const ROWS = {
        categories: () => [
            el('td', {}, el('span', { class: 'lk-tag lk-tag-red' },
                el('span', { class: 'lk-tag-family' }, 'phishing'), el('span', {}, 'credential harvesting')), badge()),
            el('td', {}, el('code', { class: 'lk-machinetag' }, 'circl:incident="phishing"')),
            el('td', { class: 'text-end lk-categories-count' }, '3'),
        ],
        resources: () => [
            el('td', {}, el('div', { class: 'lk-resource' },
                el('span', { class: 'lk-resource-icon lk-resource-type-js' },
                    el('img', { src: icon_url('javascript.png'), alt: '', width: '24', height: '24' })),
                el('div', { class: 'lk-resource-body' },
                    el('span', { class: 'lk-resource-name' }, 'login-form.js'), badge(),
                    el('div', { class: 'lk-resource-meta' },
                        el('span', { class: 'lk-resource-mime' }, 'application/javascript'),
                        el('span', { class: 'lk-resource-hash' }, `${HASH}…`))))),
            el('td', {}, el('div', { class: 'lk-resource-ctx' }, 'Unknown')),
            el('td', {}, el('span', { class: 'lk-resource-count' }, '4')),
        ],
        cookies: () => [
            el('td', {}, el('span', {}, 'session_id'), badge()),
            el('td', {}, '12'),
        ],
        favicons: () => [
            el('td', {}, el('img', { class: 'lk-tour-demo-icon', src: icon_url('img.png'), alt: 'Example favicon' }), badge()),
            el('td', {}, '5'),
        ],
        hhhashes: () => [
            el('td', {}, el('span', {}, `hhh:1:${HASH}${HASH}…`), badge()),
            el('td', {}, '3'),
        ],
    };

    // Real rows only (DataTables puts a "No data" row in an empty table)
    const hasRows = (body) => [...body.rows].some(row => !row.querySelector('.dt-empty, .dataTables_empty') && !row.classList.contains(DEMO_CLASS));

    document.addEventListener('lk-tour:before-start', () => {
        document.querySelectorAll('table[data-lk-tour-demo]').forEach(table => {
            const build = ROWS[table.dataset.lkTourDemo];
            const body = table.tBodies[0];
            if (!build || !body || hasRows(body)) return;
            body.querySelectorAll('tr').forEach(row => { row.hidden = true; row.classList.add('lk-tour-hidden'); });
            body.prepend(el('tr', { class: DEMO_CLASS }, ...build()));
        });
    });
    document.addEventListener('lk-tour:stop', () => {
        document.querySelectorAll(`table[data-lk-tour-demo] .${DEMO_CLASS}`).forEach(row => row.remove());
        document.querySelectorAll('table[data-lk-tour-demo] .lk-tour-hidden').forEach(row => {
            row.hidden = false;
            row.classList.remove('lk-tour-hidden');
        });
    });
})();
