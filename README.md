# Outbound

Work the client. Every day. A mobile-first PWA that turns outreach into a visible, structured programme — scripts, cadence, pipeline and tracker, all stored on the device. No backend, no login, works offline.

Full spec: [SPEC.md](SPEC.md). From v1.1 there is no contacts/pipeline tab: [Pipedrive](https://www.pipedrive.com) is the CRM and this app tracks activity only (log a touch, targets, heatmap, outcomes).

## Run locally
Static files only — serve the repo root with any web server:

    python3 -m http.server 8000   # then open http://localhost:8000

## Deploy
Publish the repo root with GitHub Pages (Settings → Pages → deploy from branch). Reps open the URL on their phone → Share → Add to Home Screen.

## Editing content
All scripts, templates, skills and Learn text live in `data/content.json`. Usage and favourites are stored separately on the device, so content edits never wipe history. **After any change to files, bump `CACHE` in `sw.js`** so installed apps show the "New version available" prompt. Keep script/template `id`s stable.

## Structure
`index.html`, `manifest.json`, `sw.js`, `css/app.css`, `data/content.json`, `icons/`, and `js/` (router in `app.js`, storage in `db.js`, activity log in `activity.js`, shuffle logic, and one module per page in `js/pages/`). The app name is the `APP_NAME` constant in `js/state.js` plus `manifest.json`.
