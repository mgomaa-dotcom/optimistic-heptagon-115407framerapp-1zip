# Mastery Academy imported website

## Project
This is an exported Framer website with a small Python backend for the consultation form. Keep the existing HTML, CSS, JavaScript modules, and asset folders in place. Preserve homepage content and design outside the requested form changes.

## Run on Replit
Use the **Start application** workflow. It runs:

```sh
python3 server.py
```

Open the Replit web preview to view the site. The consultation form requires the `BITRIX24_WEBHOOK_URL` and `REST_COUNTRY_TOKEN` secrets, which must remain server-side. Do not switch back to a static-only server: it cannot submit the form. PostgreSQL and App Storage dependencies are declared in `pyproject.toml`.

Publishing uses `python3 server.py` as its run command. Choose the desired publishing target in the Publishing pane; the project config intentionally does not override it.

Do not open `index.html` through a `file://` URL: JavaScript modules and the form API require HTTP. Public file serving is restricted to website assets; credentials, backend sources, and the imported archive are not served.

## Editing
- `index.html`: exported homepage markup
- `styles.css`: exported styles
- `assets/`: JavaScript modules, images, fonts, and other exported resources

The export may retain links, embedded tools, and services hosted by Framer or other providers. Running the local site does not provide a Framer content-editing backend.

## Consultation form
- `booking-form.js` / `booking-form.css`: isolated form mounted beside the hidden exported form. The same custom-element instance is preserved if Framer replaces its SSR nodes, avoiding lost input.
- `backend/providers.py`: server-side REST Countries v5 and Bitrix clients. The webhook secret may contain either the base webhook URL or the full lead-add URL.
- `backend/booking.py`: validation, CRM mappings, and persistent idempotency tracking.
- `server.py`: public website serving, options endpoint, submission endpoint, and basic request limiting.

All visible fields are required except website. Full name must contain at least two name parts separated by spaces; the first part maps to Bitrix First Name and the remaining parts map to Last Name. Older already-open forms with separate name fields remain compatible. Phone requires an international country code. Phone and sales-team inputs normalize Arabic/Persian digits to English digits and use a Latin-digit font. "Number of sales" is interpreted as sales-team headcount, not revenue.

`country-picker.js` provides the searchable country combobox, with Saudi Arabia first, country flags, English/Arabic name search, and keyboard selection. Typed text must match a valid country before submission.

Submissions create a company, then a linked contact, then a lead linked to both. Employee-size options come from Bitrix's `EMPLOYEES` statuses and are saved to Company Employees. Sales-team headcount is mapped to the lead custom field labeled `No_of_employees`. Country is always saved to the company's and lead's standard address-country fields; where a custom Country enumeration contains a matching option, that is populated too. No new enumeration options are created automatically. Optional website is saved to Company and Lead WEB. Lead comments include both headcounts and country.

REST Countries is paginated server-side and cached for 24 hours. Both secrets are used only in server-side outbound requests.

The managed PostgreSQL table `booking_submissions` stores only idempotency keys, payload hashes, created CRM IDs, pending stages, and timestamps—not form contents. PostgreSQL row locks and a committed pending-stage claim prevent concurrent app instances from repeating CRM writes. If a remote write times out, do not automatically retry that stage: it may have succeeded.

The three existing completed retry records were copied from `.local/booking-state.sqlite3` into development PostgreSQL and verified; the SQLite file remains untouched and private. `python3 -m backend.migrate_booking_state` safely verifies or copies metadata again, refusing conflicting rows. The app does not create the production schema at startup: Replit Publish applies the development database schema to production. Confirm the `booking_submissions` table is present in development before publishing.

## Form checks
Run backend checks with `python3 -m unittest discover -s tests -v`. They use fake providers and do not create CRM records. PostgreSQL integration tests use temporary UUIDs and remove only their own rows. `tests/browser_form_check.py` exercises the live form in a local headless Chromium debugging session on port 9222; its submission responses are deliberately stubbed. Live CRM creation requires a separately approved, clearly labeled test submission.

## Consultation thank-you page

Confirmed `ok: true` responses from `/api/booking` navigate to `/thank-you` using a fixed same-origin destination. The Arabic RTL confirmation page (`thank-you.html`, `assets/css/thank-you.css`, `assets/js/thank-you.js`) includes short entrance/checkmark animations, reduced-motion support, and working homepage/track links. No form values or CRM identifiers are put in the URL or browser storage. Failed, rejected, and uncertain deliveries remain on the original form. The thank-you route and its trailing-slash variant both serve the static page and can be refreshed without submitting again.

`python3 tests/browser_thank_you_check.py` checks the actual success redirect with a stubbed submission response, five failure paths, uncertain delivery, mobile/tablet/desktop layouts, reload, and reduced motion. It never writes to CRM. The existing form regression test intercepts only the final redirect so it can still verify form validation and responsive layout.

## Homepage layout and booking menus

`assets/js/homepage-layout.js` and `assets/css/homepage-layout.css` enhance the hero, existing statistics, and training diagram without rewriting the exported runtime. Statistics retain their original values and descriptions; metrics follow a slow upright orbit with viewport-triggered count-up, visible motion controls, offscreen/tab-hidden pausing, and a static reduced-motion layout. The customer-service branch supplements the existing three sales paths. `hero-image.css` retains first-paint mobile sizing and dashboard-canvas scale stabilization.

`assets/js/accreditation.js` and `assets/css/accreditation.css` insert the four academy-supplied accreditation images before the company logo section. Use supplied artwork rather than generating or guessing certification marks.

`assets/js/booking-menu.js` supplies the employee picker and shared viewport-aware positioning for employee and country menus. Menus use the popover top layer to avoid transformed-ancestor clipping, keep a gap from their inputs, and flip upward when needed. The original employee select remains the validated form/payload source. Browsers without popover support get an in-flow menu.

`python3 tests/browser_homepage_layout_check.py` verifies exact copy, the four images, count-up, full-orbit collision-free geometry, pause/reduced motion, and training branches at 320/390/768/1440px. `python3 tests/browser_dropdown_check.py` verifies menu placement, viewport bounds, keyboard/pointer selection, and outside dismissal. These use Chromium debug port 9222 and never submit live CRM records.

`assets/css/typography-stability.css` uses the locally hosted IBM Plex Sans Arabic faces as `Mastery Arabic`, with preloads, real regular/semibold weights, and fixed first-paint breakpoint geometry. `assets/js/homepage-boot.js` keeps hero copy and text-only hydration fallbacks consistent before paint. The lightweight layout/accreditation enhancements start in the head and wait for each section to finish parsing; reconciliation runs in microtasks so Framer replacements do not leave a painted gap. Do not move their styles back to the body or replace first-paint checks with settled screenshots. `python3 tests/browser_typography_stability_check.py` samples missing headings, font changes, section dimensions, metric presence, matching customer-service tile styling, and icon motion/pause/reduced-motion at four viewport widths.

## Homepage video

The existing video frame immediately above the statistics is filled by `assets/js/homepage-video.js`, styled by `assets/css/homepage-video.css`. It keeps one YouTube player (`1xNjiL8OELY`) across Framer hydration, loading the IFrame API at 35% visibility. It autoplays muted inline, pauses offscreen or in a hidden tab, and respects manual pause. A play button handles blocked autoplay; errors provide a direct YouTube link. Coral outer shadows preserve the border glow. The homepage no longer requests the storage-backed MP4.

`backend/media.py` serves only the explicitly selected object from the existing App Storage bucket at `/media/academy-introduction.mp4`. It uses Replit-managed authentication via the Python storage SDK's identity configuration and the underlying GCS client for bounded reads; credentials never reach the browser. HTTP GET ranges and HEAD support playback and seeking without loading the 350 MB object into memory or Git. Storage errors return 503; unknown media paths are not exposed. Dependencies are tracked in `pyproject.toml` and `uv.lock`.

Ranged responses are capped at 8 MiB, including open-ended requests such as `bytes=0-`, with an accurate `Content-Range` for the returned segment. This avoids oversized responses through the publishing proxy; browsers request subsequent segments. Temporary storage lookup/read failures get one server-side retry and sanitized diagnostics, and the visible player retries network/source errors twice before showing the manual retry button.

Run `python3 -m unittest discover -s tests -p 'test_*.py'` for the retained backend route and `node tests/video_recovery_check.cjs` for YouTube visibility/playback checks. With Chromium debug port 9222 running, `python3 tests/browser_video_check.py` checks the embed, hydration, responsive dimensions, and actual autoplay without creating CRM records. Set `VIDEO_TEST_BASE_URL` to a verified production URL to run against the published site.

## Homepage motion
`assets/js/learning-enhancements.js` progressively enhances the sitemap, sales tracks, and methodology without rewriting the exported Framer bundle. `assets/css/learning-enhancements.css` scopes the layout changes to those sections. GSAP 3.13.0 is served locally from `assets/vendor/gsap.min.js`, with its license header retained.

The sitemap advances every 4.8 seconds and tracks every 4.5 seconds when visible. Both have manual selection and pause controls and pause during hover, focus, hidden tabs, and reduced-motion preferences. Methodology retains its existing before/after tabs and content in wider numbered stages. `python3 tests/browser_motion_check.py` exercises motion, manual synchronization, mobile sizing, both methodology phases, and reduced motion using the same Chromium debugging session as the form checks; it never submits CRM data.

## Preview verification
The homepage rendered at desktop and mobile sizes, the proxied preview returned HTTP 200, and all directly referenced local files were present. The imported Framer runtime reports a recoverable React hydration warning, and Framer blocks its embedded editor on other domains. These export limitations were left unchanged to preserve the imported site; interactive flows have not been comprehensively tested.
