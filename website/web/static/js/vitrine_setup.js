// Vitrine web components (vendor/vitrine/, installed by tools/3rdparty.py):
// defines <vt-markdown>, points vitrine at its files and follows the Lookyloo
// light / dark theme. Pages import it, then the other components they use
// (js/api_reference.js). Doc: doc/ui/vitrine.md
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

// For the page modules that need other settings (js/capture_components.js)
export { configure };
