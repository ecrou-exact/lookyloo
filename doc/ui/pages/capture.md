# Full capture form

Route `capture_web` (`/capture`), template `capture/capture.html`, CSS
`css/capture.css`, behaviour `js/capture.js` (unchanged).

## Layout

Page header, then two columns (one column below 1100px):

- **Sections** (numbered collapsible cards, `<details>`, macro `section()` local
  to the template; only the first one (What to capture) open by default; a link of the summary
  panel or an invalid field opens its section, see `js/capture.js`):
  1. What to capture: URL / multiple URLs / document tabs
  2. Privacy: public / unlisted / private as radio cards, seed expiration
  3. Browser: own user-agent, predefined (OS type, OS, browser, user-agent or
     mobile device), or free text
  4. Advanced settings, in collapsible groups: Behaviour (JavaScript, tracking,
     trusted timestamps, video, waits, viewport, categories), Network & headers
     (proxy, referer, locale, headers, DNT, HTTP auth), Emulation (timezone,
     color scheme, geolocation), Session & scripts (cookies, storage state,
     init script)
  5. Capture engine (Lacus): instance, browser interface, predefined proxy
  6. Monitoring (if enabled), 7. Auto-Report (logged-in users)
- **Summary panel** (sticky): links to the sections, the default visibility and
  the "Start looking!" button (sticky at the bottom on small screens).

Warnings about stored credentials (HTTP auth, cookies, storage state) are red
callouts; other help texts are hints under the fields.

## Contract

Every field `name` and every `id` of the previous form is kept: `capture_web()`
reads the names, `js/capture.js` toggles the ids (`singleCaptureField`,
`multipleCapturesField`, `os-type`, `os`, `sel_*`, `device-name-mobile`,
`personal_ua`, `freetext_ua`, `seed_expire`, `remote_lacus_name`,
`remote_lacus_proxy_name_*`, `user_defined_proxy`,
`collapseMonitoringConfiguration`, `collapseMailConfiguration`...). Only the
wrapper `collapsePrivacySettings` was removed (unused by JS). To check after an
edit: compare `grep -o 'name="[^"]*"'` and the ids before/after.
