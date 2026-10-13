// Vitrine web components (vendor/vitrine/, installed by tools/3rdparty.py) on the
// capture page: <vt-markdown> for the notes of the analyst (js/tree.js).
// Doc: doc/ui/pages/tree.md
import { configure } from '../vendor/vitrine/esm/vt-markdown.js';

const base = new URL('../vendor/vitrine/', import.meta.url).href;

// Light / dark like the rest of Lookyloo (data-bs-theme on <html>, js/theme_toggle.js)
const lookylooTheme = () => (document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light');

configure({
    languagesUrl: `${base}languages/`,
    syntaxThemesUrl: `${base}syntax-themes/`,
    vendorUrl: `${base}vendor/`,
    theme: lookylooTheme(),
});

new MutationObserver(() => configure({ theme: lookylooTheme() }))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
