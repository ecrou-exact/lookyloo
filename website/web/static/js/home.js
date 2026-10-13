"use strict";
// Home page (home/home.html): loads the latest captures fragment with the
// Lookyloo eyes shown meanwhile. Doc: doc/ui/pages/home.md
// Add ?loader_demo=<seconds> to the URL to slow it down and see the loader.

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('lk-latest-captures');
    if (!container) {
        return;
    }
    lkLoaderDemoDelay()
        .then(() => fetch(container.dataset.remote))
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Server-rendered and escaped fragment (home/latest_captures.html)
            container.innerHTML = html;
            lkRelativeTimes(container);
            add_event_js_copy();
        })
        .catch(() => {
            container.textContent = 'Unable to load the latest captures, please reload the page.';
            container.classList.add('lk-latest-empty');
        });
});
