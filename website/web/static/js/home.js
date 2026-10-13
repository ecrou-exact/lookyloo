"use strict";
// Home page (home/home.html): loads the latest captures fragment with the
// Lookyloo eyes shown meanwhile (only if it takes a while, see loader.css).
// Doc: doc/ui/pages/home.md

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('lk-latest-captures');
    if (!container) {
        return;
    }
    fetch(container.dataset.remote)
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

// Capture bar: example URLs "typed" in the placeholder, letter by letter.
// Only the placeholder changes (never the value); stops as soon as the field is
// focused or filled, and is disabled with prefers-reduced-motion.
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('quick-capture-url');
    if (!input || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    const examples = [
        'https://suspicious-link.example/login',
        'https://bit.ly/3xAmpl3',
        'http://paypal-account-verify.example.net/',
        'https://your-bank.example.com/secure/update',
        'https://www.circl.lu',
    ];
    const original = input.placeholder;
    let stopped = false;
    let timer = null;
    const stop = () => {
        stopped = true;
        clearTimeout(timer);
        input.placeholder = original;
    };
    input.addEventListener('focus', stop, { once: true });
    input.addEventListener('input', stop, { once: true });

    let example = 0;
    let length = 0;
    let deleting = false;
    const step = () => {
        if (stopped) {
            return;
        }
        const text = examples[example];
        length += deleting ? -1 : 1;
        input.placeholder = text.slice(0, length) + (deleting ? '' : '▍');
        let delay = deleting ? 25 : 55 + Math.random() * 60;
        if (!deleting && length === text.length) {
            deleting = true;
            delay = 1800;            // pause on the full URL
        } else if (deleting && length === 0) {
            deleting = false;
            example = (example + 1) % examples.length;
            delay = 400;
        }
        timer = setTimeout(step, delay);
    };
    timer = setTimeout(step, 800);
});
