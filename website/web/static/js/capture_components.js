// Vitrine components of the capture page (tree/tree.html): <vt-markdown> for the
// notes (js/tree.js), <vt-json> for the MISP export, and the file viewer of the
// forensic acquisition (<vt-json>, <vt-code>, <vt-markdown>). Doc: doc/ui/pages/tree.md
import { configure } from './vitrine_setup.js';
import '../vendor/vitrine/esm/vt-json.js';
import '../vendor/vitrine/esm/vt-code.js';

// MISP exports embed the resources of the capture: allow vitrine's maximum (50 MiB)
const MAX_JSON = 52428800;
configure({ maxSize: MAX_JSON });

// Copy to the clipboard, and say it on the button for 2 seconds ("Copied" / "Copy failed")
function copyWithFeedback(button, text) {
    const label = button.lastChild;
    const before = label.textContent;
    const show = (message, ok) => {
        label.textContent = ` ${message}`;
        button.classList.toggle('is-copied', ok);
        button.classList.toggle('is-copy-failed', !ok);
        clearTimeout(button.copyTimer);
        button.copyTimer = setTimeout(() => {
            label.textContent = before;
            button.classList.remove('is-copied', 'is-copy-failed');
        }, 2000);
    };
    if (!navigator.clipboard) {
        show('Copy failed', false);
        return;
    }
    navigator.clipboard.writeText(text).then(() => show('Copied', true), () => show('Copy failed', false));
}
window.copyWithFeedback = copyWithFeedback;   // also used by js/tree.js (notes)

// MISP export: the menu entry opens #mispExportModal, which loads the export
// (data-export of the link) and shows it in <vt-json>; Download and Copy buttons.
const modal = document.getElementById('mispExportModal');
if (modal) {
    const viewer = document.getElementById('misp-export-json');
    const status = document.getElementById('misp-export-status');
    let current = null;   // {text, filename}
    const buttons = [document.getElementById('misp-export-download'), document.getElementById('misp-export-copy')];
    const ready = (on) => buttons.forEach(button => { button.disabled = !on; });

    const download = () => {
        if (!current) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([current.text], { type: 'application/json' }));
        link.download = current.filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };

    modal.addEventListener('show.bs.modal', async (event) => {
        const url = event.relatedTarget?.dataset.export;
        if (!url) return;
        current = null;
        ready(false);
        viewer.hidden = true;
        status.hidden = false;
        status.innerHTML = lkLoader('Preparing the MISP export', 'md', true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            current = { text, filename: `lookyloo-${treeUUID}.misp.json` };
            ready(true);
            const size = `${(text.length / 1048576).toFixed(1)} MiB`;
            if (text.length > MAX_JSON) {
                status.textContent = `The export (${size}) is too big to be shown here: download it.`;
                return;
            }
            status.hidden = true;
            await customElements.whenDefined('vt-json');
            viewer.content = text;
            viewer.hidden = false;
        } catch (error) {
            status.textContent = `The MISP export failed (${error.message}).`;
        }
    });
    document.getElementById('misp-export-download').addEventListener('click', download);
    const copy_button = document.getElementById('misp-export-copy');
    copy_button.addEventListener('click', () => {
        if (!current) return;
        copyWithFeedback(copy_button, current.text);
    });
}

// Forensic acquisition (tree/modals/download_elements.html, loaded in the side
// panel): a button per text file; the file is shown below, in the vitrine element
// of its kind, which loads it itself (src, same origin).
const VIEWERS = {
    json: () => document.createElement('vt-json'),
    html: () => { const el = document.createElement('vt-code'); el.setAttribute('language', 'html'); return el; },
    markdown: () => { const el = document.createElement('vt-markdown'); el.setAttribute('default-tab', 'source'); return el; },
    text: () => { const el = document.createElement('vt-code'); el.setAttribute('language', 'plaintext'); return el; },
};
document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lk-view-src]');
    if (!button) return;
    const slot = button.closest('.lk-file-viewer')?.querySelector('.lk-file-viewer-slot');
    const make = VIEWERS[button.dataset.lkViewKind];
    if (!slot || !make) return;
    button.parentElement.querySelectorAll('[data-lk-view-src]').forEach(b => b.setAttribute('aria-pressed', b === button ? 'true' : 'false'));
    const viewer = make();
    viewer.classList.add('lk-vitrine', 'lk-file-viewer-content');
    viewer.setAttribute('variant', 'full');
    viewer.setAttribute('max-height', '60vh');
    viewer.setAttribute('label', button.dataset.lkViewName);
    viewer.setAttribute('download', button.dataset.lkViewName);
    viewer.setAttribute('src', button.dataset.lkViewSrc);
    slot.replaceChildren(viewer);
});
