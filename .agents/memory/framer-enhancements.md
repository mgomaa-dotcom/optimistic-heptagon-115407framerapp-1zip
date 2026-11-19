---
name: Framer enhancement lifecycle
description: Non-obvious hydration and observer constraints for adding interactive enhancements to this exported site.
---

Framer hydration can replace entire page sections, not just their child nodes. Enhancements must rediscover current section roots and clean up timers, observers, and listeners belonging to detached roots.

**Why:** Capturing section elements once left successfully initialized animation controls detached after hydration, even though initialization flags still indicated success.

**How to apply:** For enhancements outside Framer's component tree, reconnect them after section replacement and prevent duplicate instances. Mutation observers should write text only when the value changes; unconditional text replacement can trigger their own child-list observers repeatedly.

Framer exports can paint final artwork before the runtime resets its entrance state, and can apply responsive transforms only during hydration. Treat a reload flash as a possible first-paint/hydration mismatch, not necessarily an image download problem.

**Why:** The mobile hero was initially visible at desktop scale, then became nearly transparent and resized when hydration replayed its entrance.

**How to apply:** Keep initial responsive geometry consistent with the hydrated state and avoid competing entrance controllers on already-visible artwork. Verify from first paint through hydration with animation-frame sampling; a settled screenshot alone cannot catch this. Sample nested visual canvases too: a stable outer frame does not prove its contents are stable. The dashboard's internal fit calculation briefly reverted to a different initial scale even after the surrounding hero was fixed.
