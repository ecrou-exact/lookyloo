# Lookyloo security review

Web attacks review of Lookyloo (XSS, injections, files, access control, CSRF,
SSRF, denial of service), on branch `ui-redesign-tree` (fork
`ecrou-exact/lookyloo`), compared with `main` (before the UI redesign).

- Date: 2026-10-14
- Scope: `website/web/` (Flask routes, REST API, templates, JavaScript),
  `lookyloo/lookyloo.py`, `lookyloo/capturecache.py`, `lookyloo/helpers.py`,
  `lookyloo/modules/`.
- Method: code review in three parts (XSS / files / access and requests), the
  main findings checked again by hand, each one looked up in `main`.
- **Not to be published** before the maintainer has read it: some findings are
  exploitable by anonymous users.

## Summary

- No exploitable XSS, no SQL injection (there is no SQL: Valkey + files), no
  path traversal, no open redirect.
- The risks are **server-side requests to arbitrary addresses (SSRF)**,
  **admin actions reachable from another site (CSRF)** and **memory / queue
  denial of service**.
- **Every finding below was already in `main`**: the UI redesign did not add
  any. It fixed a few problems that were in `main` (last section).

## Findings

Severity: High / Medium / Low. "Before the redesign": the problem is in `main`.

| # | Problem | Where | Who can do it | Severity | Before the redesign |
|---|---|---|---|---|---|
| 1 | SSRF through the **proxy** field of the capture form | `website/web/__init__.py`, `capture_web` | anonymous | High | Yes |
| 2 | SSRF through **pull a capture from another instance** | `/submit_capture` (`pull_capture_domain`) | anonymous | Medium | Yes |
| 3 | SSRF through **Push to another Lookyloo** | `/tree/<uuid>/lookyloo_push` | anonymous | Medium | Yes |
| 4 | **CSRF**: admin actions on GET | `/tree/<uuid>/remove`, `/tree/<uuid>/rebuild`, `/rebuild_all`, `/rebuild_cache` | another site, against a logged-in admin | Medium | Yes |
| 5 | **Uploads without size limit**, 1 GiB decompressed in memory per import | `/submit_capture`, `POST /json/upload`, `unpack_full_capture_archive` | anonymous | Medium | Yes |
| 6 | **No rate limit on login** (password brute force) | `/login`, `/json/get_token` | anonymous | Medium | Yes |
| 7 | **Unbounded bulk captures** | `/bulk_captures/<uuid>` | anonymous | Medium | Yes |
| 8 | **Raw HTML in the Ollama report** (`markdown` filter) | `tree/modals/ollama_report.html`, `markdown_filter` | a captured page, against an admin | Low | Yes |
| 9 | `innerHTML` with a category name | `static/js/render_tables.js` ("Review categories") | admin | Low | Yes |
| 10 | UUID of an imported capture not normalised | `store_capture`, `unpack_full_capture_archive` | anonymous | Low | Yes |

### 1. SSRF through the proxy field (High, before the redesign: yes)

```python
elif proxy := request.form.get('proxy'):
    parsed_proxy = urlparse(proxy)
    if parsed_proxy.scheme and parsed_proxy.hostname and parsed_proxy.port:
        if parsed_proxy.scheme in ['http', 'https', 'socks5', 'socks5h']:
            capture_query['proxy'] = proxy
```

`POST /capture` with `proxy=http://127.0.0.1:6379` (or `10.x`, `169.254.169.254`):
the browser of Lacus connects to any host and port the attacker picks, from the
network of Lacus (port scan, requests to internal services). The captured URL
is SSRF by design; the proxy reaches hosts and ports a filter on the URL would
not see. Anonymous when the capture form is public (default).

**Fix**: only the proxies configured on the instance (or the Lacus ones), or
refuse private, loopback and link-local addresses; or login required for a
free proxy.

### 2. SSRF through "pull from another instance" (Medium, before: yes)

`/submit_capture` gives `request.form['pull_capture_domain']` to
`PyLookyloo(...)`, which calls `is_up`, `get_status`, then downloads the
capture: GET requests to any URL. The error message tells whether the host
answers (scan of the internal network). The downloaded archive has no size
limit before the 1 GiB check (see 5).

**Fix**: allowlist of instances in the configuration, or login required.

### 3. SSRF through "Push to another Lookyloo" (Medium, before: yes)

`/tree/<uuid>/lookyloo_push`: `PyLookyloo(remote_lookyloo_url).upload_capture(...)`,
a POST of the whole capture archive to any URL; the exception text comes back
in a flashed message. Anonymous, on any capture they can see.

**Fix**: same as 2.

### 4. CSRF on admin GET routes (Medium, before: yes)

`/tree/<uuid>/remove`, `/tree/<uuid>/rebuild`, `/rebuild_all`, `/rebuild_cache`
(login required) change state on GET. The session cookie is `SameSite=Lax`
(set by Talisman), so it is sent on a top-level navigation from another site:
a link or a `window.location` on a malicious page makes a logged-in admin
delete a capture or rebuild every cache. Also: `trigger_modules` (spends the
API quotas of the modules, as admin when the victim is one), `trigger_indexing`.

**Fix**: POST for these actions (the delete of the admin preview, added during
the redesign, is already POST).

### 5. Uploads without size limit (Medium, before: yes)

- No `MAX_CONTENT_LENGTH`: `BytesIO(request.files['full_capture'].stream.read())`,
  `base64.b64decode(parameters['full_capture'])` (API) read everything in memory.
- The zip bomb check uses the sizes declared in the archive (bounded by the
  real decompression, 1 GiB), but 1 GiB is decompressed in memory per request,
  then parsed (`orjson.loads`).

A few requests at the same time exhaust the memory of the gunicorn workers.

**Fix**: `MAX_CONTENT_LENGTH`, lower limits per member and in total, enforced
on the bytes really decompressed.

### 6. No rate limit on login (Medium, before: yes)

`/login` and `/json/get_token`: no throttling, no lockout. The password hash
(pbkdf2 / scrypt) slows each try down, which also makes each try a CPU cost.

**Fix**: rate limit per IP and per user (e.g. Flask-Limiter, or nginx).

### 7. Unbounded bulk captures (Medium, before: yes)

`/bulk_captures/<uuid>`: `user_urls.strip().split('\n')` without limit, one
request queues thousands of captures (with the settings of the parent capture,
proxy included, see 1).

**Fix**: maximum number of URLs per request for anonymous users.

### 8. Raw HTML in the Ollama report (Low, before: yes)

```python
@app.template_filter('markdown')
def markdown_filter(blob: str) -> str:
    md = markdown.markdown(blob)
```

`markdown.markdown()` keeps raw HTML. The filter is used on the report of the
model (`{{ report | markdown }}`), whose text is driven by the captured page
(prompt injection). The CSP blocks scripts and inline handlers (with a nonce,
browsers ignore `'unsafe-inline'`), so no script runs, but links, forms or
styles can be injected in the panel of an admin (Ollama is admin only).

**Fix**: sanitise the HTML of the Markdown (or render the report as text, or
with vitrine `<vt-markdown>`, which sanitises with DOMPurify).

### 9. `innerHTML` with a category name (Low, before: yes)

```js
elt.innerHTML = `<input ... value='${item}' checked hidden> <label ...>${item}</label>`;
```

"Review categories" (admin). The categories are checked against the
`content-classification` taxonomy before being stored, so free text should not
get there; it is a known sink (AGENTS.md).

**Fix**: build the elements with DOM APIs and `textContent` / `value`.

### 10. UUID of an imported capture not normalised (Low, before: yes)

`UUID(uuid)` accepts `urn:uuid:…`, `{…}`, upper case, no hyphens, and the
string is stored as given. The duplicate check (`uuid_exists_in_cache`) is done
on the raw string: the same UUID written differently creates a second capture.
No file is overwritten (new timestamped directory), no path character gets
through.

**Fix**: `str(UUID(x))` before the check and before storing.

## By design, to know

| Behaviour | Before the redesign |
|---|---|
| Anyone can make a public capture more private (unlisted, or private with a seed), never less: it disappears from the public view (`POST /admin/<uuid>/private`, `/admin/<uuid>/hide`, visibility form). | Yes |
| Anonymous users can add categories to a recent capture (removal: admin only). | Yes |
| The `init_script` field runs JS in the browser of the capture (already exposed to hostile pages). | Yes |
| The captured URL is SSRF by design (that is what Lookyloo does). | Yes |

## Checked, no problem

- **XSS, server side**: autoescape on, no `|safe` (the last one removed during
  the redesign), the HTML built in Python goes through `Markup.format`
  (`SafeMiddleEllipsisString`, `get_icon`, `details_modal_button`,
  `category_tag`, `icon`, flashed messages); `tojson` in `<script>` escapes
  `</script>`.
- **XSS, client side**: `innerHTML` only on fragments rendered and escaped by
  Flask (panels, pop-ups), data of the tree written with `textContent` / D3
  `.text()`; notes of the analyst only exported as Markdown text.
- **No `javascript:` link**: a captured URL is never put in an `href`.
- **Files**: an imported archive is read in memory, only known names are kept
  and written under fixed names (no zip slip); no pickle can come in (pickles are
  only written by the tree builder, never imported or exported); no route
  builds a path from user input; download names are encoded by Werkzeug.
- **Private captures**: `before_request` checks the seed (or the login) on
  every route with a capture UUID, API included; private captures are never
  in the public index, so the correlation pages don't show them.
- **Open redirect**: every `redirect()` goes through `url_for`, no `next`.
- **E-mail**: `Reply-To` only when it matches the e-mail pattern, the rest
  comes from the configuration; the comment is only in the body.
- **Redis**: user data is never part of a key name.
- **External requests of the interface**: none (checked by recording the
  network requests of 17 pages and their panels).

## Fixed during the UI redesign (they were in `main`)

| Problem | Effect in `main` | Fix |
|---|---|---|
| Inline `onchange` on "push anyway" (MISP push panel) | blocked by the CSP: the checkbox did nothing | `data-lk-enables`, listener in `js/tree_modals.js` |
| `| safe` in the storage state panel | against the rule "no `|safe`" (value already escaped) | removed |
| Link to a `cookieNameModal` that did not exist (storage state) | click on a cookie: nothing | panel added |
| `overrides.js` (instance hook) loaded without CSP nonce | blocked when the CSP is strict | nonce added |
| Error page shown inside a panel when the capture is gone | home page and flashed error in the panel | warning in the panel |
| Resources page failing on a removed capture | whole page redirected with an error | removed captures skipped |
| Removed capture still listed (Valkey + memory of the workers) | ghost rows, errors when clicked | `CapturesIndex.forget()` |
| Malformed URL accepted by the capture form | broken capture created | form shown again with the error |

Introduced then fixed on the branch: the script of the delete confirmation of
the admin preview had no nonce (fixed in the audit commit).

## Suggested order

1. Without change of behaviour: 8, 9, 10, then 4 (POST).
2. Limits: 5, 7, 6.
3. To decide with the maintainer (they change what anonymous users can do):
   1, 2, 3.
