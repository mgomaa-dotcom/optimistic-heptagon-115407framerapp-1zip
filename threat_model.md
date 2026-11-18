# Threat Model

## Project Overview

An imported (Framer-exported) static marketing website for "Mastery Academy" with a
small Python standard-library HTTP backend (`server.py`) that serves the site and
powers a single consultation/booking form. The backend proxies form submissions to
Bitrix24 CRM and fetches a country list from the REST Countries v5 API. It also
streams one homepage video from a private Replit App Storage bucket. There are no
user accounts, sessions, or admin roles — the only privileged resources are the
server-side API credentials and the integrity/cost of the downstream CRM.

Tech stack: Python 3 `http.server` (ThreadingHTTPServer), no web framework;
vanilla JS front-end; SQLite for idempotency state; Bitrix24 + REST Countries as
external services; hosted on Replit.

## Assets

- **Application secrets** — `BITRIX24_WEBHOOK_URL` (grants write access to the CRM)
  and `REST_COUNTRY_TOKEN`. Read only server-side from env; never sent to clients.
- **CRM integrity and quota** — the public booking endpoint creates Company, Contact,
  and Lead records in Bitrix24. Abuse means spam leads, data pollution, API quota
  exhaustion, and potential billing impact.
- **PII in transit** — submitter name, email, phone, company. Handled transiently;
  not persisted locally (only hashes/IDs stored in SQLite).
- **Private storage object** — the homepage video in App Storage, served via
  Replit-managed identity.

## Trust Boundaries

- **Browser → backend HTTP** — all requests untrusted. No auth exists; the booking
  endpoint is intentionally public, so the controls that matter are input validation,
  rate limiting, and same-origin/content-type gating.
- **Backend → Bitrix24 / REST Countries** — outbound calls using server-side
  credentials. No user-controlled URL is fetched (website field is stored, not fetched).
- **Backend → filesystem** — static file serving is restricted by an allowlist
  (`STATIC_FILES`) plus `assets/` prefix, a dotfile-part rejection, and an
  `is_relative_to(ROOT)` check.
- **Reverse proxy → app** — Replit's edge proxy sits in front of the app and sets
  forwarding headers; the app must not trust client-supplied `X-Forwarded-For`.

## Scan Anchors

- Production entry points: `server.py` (`do_GET`, `do_HEAD`, `do_POST`), with route
  dispatch to `backend/media.py:serve_video` and `backend/booking.py:Booking.submit`.
- Highest-risk code: `backend/booking.py` (validation + CRM mutations + idempotency),
  `backend/providers.py` (Bitrix/REST Countries clients, credential handling),
  `server.py` rate limiter and static file handler.
- Public surfaces: `/` + static assets, `/media/academy-introduction.mp4`,
  `/api/booking/options` (GET), `/api/booking` (POST). No authenticated or admin surface.
- Dev-only / ignore: `tests/`, `attached_assets/`, `zipFile.zip`, `.local/` state.

## Threat Categories

### Tampering / Denial of Service (Resource Abuse)

The booking endpoint is the only state-changing, cost-bearing action. Its sole abuse
control is a per-IP sliding-window rate limiter. The limiter keys on the leftmost
value of the client-supplied `X-Forwarded-For` header, which an attacker controls, so
the limit is bypassable (see new vulnerability). Guarantee required: rate limiting
MUST key on an IP the app can trust (Replit edge-provided client IP or the socket
peer), not on an arbitrary client header. Consider an additional anti-automation
control (CAPTCHA/proof-of-work) for CRM-creating endpoints.

### Information Disclosure

Error responses are generic and localized; provider errors log only a short
service/code pair, never URLs, credentials, or payloads. Static serving is restricted
to an allowlist + `assets/`, rejecting dotfiles and path escapes. These guarantees
must be preserved: no stack traces, no credential or provider-URL leakage, and no
serving of `backend/`, `.local/`, or archive files.

### Spoofing / CSRF

The POST handler enforces `Content-Type: application/json` and rejects cross-origin
requests when an `Origin` header is present, which (together with the browser CORS
preflight model) blocks browser-driven CSRF. Since there is no authentication, a
direct non-browser POST is expected and not a privilege boundary violation.

### Elevation of Privilege

Not applicable in the usual sense — there are no roles, sessions, or per-user objects,
so there is no IDOR/BOLA surface. The CRM column name used in a dynamic SQL UPDATE in
`booking.py` comes from a fixed internal tuple, not user input.
