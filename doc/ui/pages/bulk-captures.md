# Ongoing captures (`capture/bulk_captures.html`)

The page shown after submitting several URLs at once (capture form, *multiple
URLs*), after a new capture from a node of a capture (`POST /bulk_captures/<uuid>`)
or an import: one row per queued capture, with a link to it, and its status and
error polled every 5 seconds (`GenericAPI_capture_status_query`).

## Preview (admins)

The page only exists as the answer of a form. To check the template, logged-in
users open **Previews > Ongoing captures page (bulk / import)** in their menu of
the site header: `GET /admin/preview/bulk_captures` (`preview_bulk_captures`,
login required) renders it with the latest five captures of the instance as
examples, under a *Preview* banner (`preview=True`).

## Delete from the preview

In the admin preview (`/admin/preview/bulk_captures`), each row has a
**Delete** button: a `POST` to `/admin/preview/bulk_captures/remove`
(`preview_bulk_captures_remove`, login required) with the `capture_uuid`,
which removes the capture and comes back to the preview. The browser asks for
confirmation first (`js/confirm_delete.js`: any `form.lk-confirm-delete`, the
question in `data-lk-confirm`). The column is not shown on the real page,
after a submission.

A removed capture disappears at once from every list: `Lookyloo.remove_capture()`
moves its directory to `removed_captures/`, then `CapturesIndex.forget()` drops
it from the recent captures in Valkey (`lookup_dirs`, `recent_captures`,
`recent_captures_public`) and from the cache of the process. The other web
workers drop their cached copy when they see that its directory is gone. Deleting
it a second time (an old tab) only says it was already removed.
