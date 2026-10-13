"use strict";
// Forms .lk-confirm-delete ask before they are sent: data-lk-confirm is the question.
document.querySelectorAll('form.lk-confirm-delete').forEach(form => {
    form.addEventListener('submit', event => {
        if (!window.confirm(form.dataset.lkConfirm || 'Delete? This cannot be undone.')) {
            event.preventDefault();
        }
    });
});
