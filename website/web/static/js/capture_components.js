// Vitrine components of the capture page (tree/tree.html): <vt-markdown> for the
// notes (js/tree.js) and <vt-json> for the MISP export. Doc: doc/ui/pages/tree.md
import { configure } from './vitrine_setup.js';
import '../vendor/vitrine/esm/vt-json.js';

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
// (data-export of the link), downloads it and shows it in <vt-json>.
const modal = document.getElementById('mispExportModal');
if (modal) {
    const viewer = document.getElementById('misp-export-json');
    const status = document.getElementById('misp-export-status');
    let current = null;   // {text, filename}

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
        viewer.hidden = true;
        status.hidden = false;
        status.innerHTML = lkLoader('Preparing the MISP export', 'md', true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            current = { text, filename: `lookyloo-${treeUUID}.misp.json` };
            download();
            const size = `${(text.length / 1048576).toFixed(1)} MiB`;
            if (text.length > MAX_JSON) {
                status.textContent = `The export (${size}) is too big to be shown here; it was downloaded as ${current.filename}.`;
                return;
            }
            status.textContent = `Downloaded as ${current.filename} (${size}).`;
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
