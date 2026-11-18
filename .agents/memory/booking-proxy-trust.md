---
name: Booking proxy trust
description: Security tradeoff for booking rate-limit identity behind proxies
---

Do not trust forwarding headers for booking throttling without an independently verified proxy trust boundary. Accept shared-proxy throttling rather than guessing which header entry is authentic.

**Why:** Booking creates three CRM records per submission. A falsely distinct identity permits CRM spam; a shared identity restricts availability but preserves the abuse limit. The deployment's header sanitization and trusted proxy chain have not been established.

**How to apply:** Any future move to forwarded client identities must first verify trusted peers and header handling for every supported ingress path. Adding CAPTCHA or changing the booking flow is not required to fix header spoofing.
