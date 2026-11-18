# Mastery Academy imported website

## Project
This is an exported Framer website with a small Python backend for the consultation form. Keep the existing HTML, CSS, JavaScript modules, and asset folders in place. Preserve homepage content and design outside the requested form changes.

## Run on Replit
Use the **Start application** workflow. It runs:

```sh
python3 server.py
```

Open the Replit web preview to view the site. Python's standard library is sufficient; no package installation is required. The consultation form requires the `BITRIX24_WEBHOOK_URL` and `REST_COUNTRY_TOKEN` secrets, which must remain server-side. Do not switch back to a static-only server: it cannot submit the form.

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

All visible fields are required except website. Contact name is split into first and last name, and phone requires an international country code. "Number of sales" is interpreted as sales-team headcount, not revenue.

Submissions create a company, then a linked contact, then a lead linked to both. Employee-size options come from Bitrix's `EMPLOYEES` statuses and are saved to Company Employees. Sales-team headcount is mapped to the lead custom field labeled `No_of_employees`. Country is always saved to the company's and lead's standard address-country fields; where a custom Country enumeration contains a matching option, that is populated too. No new enumeration options are created automatically. Optional website is saved to Company and Lead WEB. Lead comments include both headcounts and country.

REST Countries is paginated server-side and cached for 24 hours. Both secrets are used only in server-side outbound requests.

`.local/booking-state.sqlite3` stores submission keys, payload hashes, and created CRM IDs, not form contents. It prevents duplicate writes on retries and tracks partially completed submissions. If a remote write times out, do not automatically retry that stage: it may have succeeded. Check Bitrix before retrying. This file must remain private and out of Git. For production, use persistent storage or a managed database before relying on idempotency across instances or redeployments.

## Form checks
Run backend checks with `python3 -m unittest discover -s tests -v`. They use fake providers and do not create CRM records. `tests/browser_form_check.py` exercises the live form in a local headless Chromium debugging session on port 9222; its submission responses are deliberately stubbed. Live CRM creation requires a separately approved, clearly labeled test submission.

## Preview verification
The homepage rendered at desktop and mobile sizes, the proxied preview returned HTTP 200, and all directly referenced local files were present. The imported Framer runtime reports a recoverable React hydration warning, and Framer blocks its embedded editor on other domains. These export limitations were left unchanged to preserve the imported site; interactive flows have not been comprehensively tested.
