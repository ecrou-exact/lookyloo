"use strict";
// Loading page of a capture (tree/tree_wait.html): reloads the capture every 10
// seconds until the tree is ready (the server then shows it). While a tour is open
// (js/tour.js, body.lk-tour-running) it waits, and reloads once the tour is over.
// Doc: doc/ui/loader.md
(() => {
    const section = document.querySelector('[data-lk-reload]');
    if (!section) return;
    const DELAY = 10000;
    const reload = () => {
        if (document.body.classList.contains('lk-tour-running')) {
            setTimeout(reload, 1000);
            return;
        }
        location.href = section.dataset.lkReload;
    };
    setTimeout(reload, DELAY);
})();
