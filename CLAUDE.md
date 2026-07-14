## Context

This is Scouty, a summer camp finder for Richmond, VA (React + Leaflet, deployed on Vercel).
"Version B" won the user test and is now the single, canonical experience, served at `/`
(the old v1 layout was retired; `/v2` now redirects to `/`). Its code lives in
`src/components/v2/*` and `src/lib/v2/*`, with the shared `FilterPanel` driving the modal.
- Keep the existing camp data source and card content — the redesign changed layout and
  interaction, not data.
- All state stays session-based (localStorage) — no accounts, no signup. This is a core
  product constraint.
- Preserve all existing PostHog instrumentation.

The redesign fixed these problems from the old layout:
1. The map was small, not sticky, and disappeared once the user scrolled — it felt decorative.
   Now it's a sticky column beside the list.
2. Map pins were identical dots with no connection to the list. Now they sync on hover and
   open popups.
3. Location (zip + radius) was buried at the bottom of the Filters modal. Now it lives in the
   search pill up top, drives the map, and cards show distance.
4. All filters hid behind one "Filters" button. The three parameters every parent needs first
   — age, week, location — now live in the search pill; secondary filters (interests, session
   type, price) are in the "More filters" modal.
