---
name: Country API quirks
description: Non-obvious behavior observed when integrating REST Countries v5 from this environment.
---

Use an explicit application User-Agent for REST Countries requests from Python.

**Why:** The default Python urllib client received HTTP 403 from the service; using an application User-Agent allowed the authenticated request.

**How to apply:** Preserve the explicit User-Agent when changing the HTTP client. Never diagnose authentication by printing the token.

Country records can have empty ISO codes and flag fields even when they have valid names.

**Why:** The live v5 dataset includes additional territories without those fields, so rejecting every record with a missing code prevents the entire selector from loading.

**How to apply:** Preserve name-based identifiers for these entries and standard ISO identifiers for countries that have them; do not invent ISO codes.
