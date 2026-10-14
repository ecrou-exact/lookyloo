"use strict";
// UI mode (doc/ui/modes.md): simple (default), analyst or full. Loaded in <head>,
// before the first paint: sets data-lk-mode on <html>; elements marked with
// data-lk-min-mode="analyst" / "full" are hidden below that mode (css/base.css),
// and js/tree.js skips the features of the higher modes. The switch is in the
// site header (#lk-mode-menu); a change is remembered (localStorage) and reloads.
(() => {
    const MODES = ['simple', 'analyst', 'full'];
    const KEY = 'lk-ui-mode';
    let mode = 'simple';
    try {
        const saved = localStorage.getItem(KEY);
        if (MODES.includes(saved)) mode = saved;
    } catch (e) { /* default */ }
    document.documentElement.dataset.lkMode = mode;
    // For the other scripts: the mode, and "is it at least this one?"
    window.lkMode = { mode, atLeast: (other) => MODES.indexOf(mode) >= MODES.indexOf(other) };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-lk-mode-choice]').forEach(button => {
            const on = button.dataset.lkModeChoice === mode;
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
            button.classList.toggle('active', on);
            button.addEventListener('click', () => {
                if (button.dataset.lkModeChoice === mode) return;
                try { localStorage.setItem(KEY, button.dataset.lkModeChoice); } catch (e) { return; }
                location.reload();
            });
        });
        const label = document.getElementById('lk-mode-current');
        if (label) label.textContent = { simple: 'Simple', analyst: 'Analyst', full: 'Full' }[mode];
    });
})();
