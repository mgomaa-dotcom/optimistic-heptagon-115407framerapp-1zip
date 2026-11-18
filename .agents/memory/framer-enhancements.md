---
name: Framer enhancement lifecycle
description: Non-obvious hydration and observer constraints for adding interactive enhancements to this exported site.
---

Framer hydration can replace entire page sections, not just their child nodes. Enhancements must rediscover current section roots and clean up timers, observers, and listeners belonging to detached roots.

**Why:** Capturing section elements once left successfully initialized animation controls detached after hydration, even though initialization flags still indicated success.

**How to apply:** For enhancements outside Framer's component tree, reconnect them after section replacement and prevent duplicate instances. Mutation observers should write text only when the value changes; unconditional text replacement can trigger their own child-list observers repeatedly.
