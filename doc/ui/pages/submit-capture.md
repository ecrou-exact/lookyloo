# Submit an existing capture

Route `submit_capture` (`/submit_capture`), template
`capture/submit_capture.html`, styles shared with the full capture form
(`css/capture.css`, see [capture.md](capture.md)).

- **1. Source**, three tabs: *Pull from an instance* (`pull_capture_domain`,
  `pull_capture_uuid`), *Lookyloo export* (`full_capture`), *HAR file*
  (`har_file`, `landing_page`, `screenshot_file`, `html_file`). The view uses
  the first method filled in: pull, then export, then HAR (said on the page).
- **2. Visibility**: `listing` switch.
- Sticky panel: default visibility + "Render capture!" button (eyes while uploading).

Field names are unchanged: `submit_capture()` reads them.
