## Context

This is Scouty, a summer camp finder for Richmond, VA (React + Leaflet, deployed on Vercel).
We're building "Version B" for a user test comparing against the current layout, so:
- Build this as a separate route or deployment target (do NOT overwrite the current version).
- Keep the existing camp data source, card content, and the Filters modal — we're changing
  layout and interaction, not data.
- All state stays session-based (localStorage) — no accounts, no signup. This is a core
  product constraint.
- Preserve all existing PostHog instrumentation and add the new events listed in Phase 5.

Current problems we're fixing:
1. The map is small, not sticky, and disappears once the user scrolls — it feels decorative.
2. Map pins are identical dots with no connection to the list (no hover sync, no popups).
3. Location (zip + radius) is buried at the bottom of the Filters modal; entering a zip
   doesn't affect the map, and cards show no distance.
4. All filters hide behind one "Filters" button in the corner — poor discoverability of
   the three parameters every parent needs first: age, week, location.
