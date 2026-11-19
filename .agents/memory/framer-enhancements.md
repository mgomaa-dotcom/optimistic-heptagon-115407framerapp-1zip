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

Runtime text reconciliation may mutate text nodes without replacing elements.

**Why:** Requested hero copy could revert after appearing correct because a child-list-only observer did not see Framer's later text-node update.

**How to apply:** When maintaining enhanced copy across hydration, observe character data selectively for the relevant heading. Exclude counters and other frequently changing content to avoid unnecessary reconciliation loops.

Responsive RichText boundaries can temporarily remove headings and descriptions for multiple painted frames while the surrounding section remains mounted.

**Why:** Correct font preloads, early layout styles, and same-turn reconciliation removed size changes but did not prevent a brief empty hero: the live text block itself was absent during responsive hydration.

**How to apply:** Retain a last-known text-only block while its live counterpart is absent, remove that fallback immediately when the original returns, and keep both layouts identical. Validate missing-node frames as well as dimensions. Early enhanced content is not proof that Framer has finished loading; interaction tests holding DOM references should wait for load, while separate frame-sampling checks cover startup.
