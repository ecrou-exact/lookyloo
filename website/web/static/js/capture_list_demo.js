"use strict";
// Tutorial of the list of captures (home/index.html): when the list is empty, an
// example row (marked "Example", made up) is shown while the tour runs, so every part
// of a capture row can be explained; it is removed when the tour ends (js/tour.js
// events). Built with DOM APIs: the same classes as the rows of post_table / index_row.
(() => {
    const table = document.getElementById('IndexTable');
    if (!table) return;
    const DEMO_CLASS = 'lk-tour-demo';

    const el = (tag, attrs = {}, ...children) => {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        children.forEach(child => node.append(child));
        return node;
    };

    function demoRow() {
        const thumb = el('span', { class: 'lk-thumb is-blurred lk-tour-demo-thumb', 'aria-hidden': 'true' });
        const head = el('div', { class: 'lk-capture-head' },
            el('a', { class: 'lk-capture-title', href: '#IndexTable' }, 'Sign in to your account'),
            el('span', { class: 'lk-verdict lk-verdict-malicious' }, 'Malicious'),
            el('span', { class: 'lk-tour-demo-badge' }, 'Example'));
        const url = el('div', { class: 'lk-capture-url' }, 'https://login.example.com/account/verify');
        const facts = el('ul', { class: 'lk-capture-facts' },
            el('li', {}, '2 redirects: short.example → login.example.com'));
        const tags = el('div', { class: 'lk-capture-tags' },
            el('span', { class: 'lk-tag lk-tag-red' }, el('span', { class: 'lk-tag-family' }, 'phishing'), el('span', {}, 'credential harvesting')));
        const capture = el('div', { class: 'lk-capture' }, thumb, el('div', { class: 'lk-capture-body' }, head, url, facts, tags));
        const time = el('td', { class: 'text-end' }, el('span', {}, 'a minute ago'));
        return el('tr', { class: DEMO_CLASS }, el('td', {}, capture), time);
    }

    document.addEventListener('lk-tour:before-start', () => {
        const body = table.tBodies[0];
        if (!body || body.querySelector('.lk-capture')) return;   // real captures: nothing to add
        body.querySelectorAll('tr').forEach(row => { row.hidden = true; row.classList.add('lk-tour-hidden'); });
        body.prepend(demoRow());
    });
    document.addEventListener('lk-tour:stop', () => {
        table.querySelectorAll(`.${DEMO_CLASS}`).forEach(row => row.remove());
        table.querySelectorAll('.lk-tour-hidden').forEach(row => { row.hidden = false; row.classList.remove('lk-tour-hidden'); });
    });
})();
