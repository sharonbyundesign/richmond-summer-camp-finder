# Migrations

Numbered, paste-and-run SQL for the Supabase SQL Editor. Each migration is a
pair: `NNN_name.up.sql` applies it, `NNN_name.down.sql` rolls it back.

The loose `*.sql` files in the repo root predate this directory and are kept as
a historical record of how the camp data was built. Nothing here replaces them.

## How to run one

1. Open the Supabase SQL Editor.
2. Paste the **whole file**.
3. Press Run with **nothing selected** — a text selection makes the editor run
   only the selected part, which is how you end up with half a migration.

Every file is wrapped in `BEGIN`/`COMMIT`, so an error anywhere rolls the whole
thing back and leaves the database untouched. Every file is also safe to re-run:
columns use `ADD COLUMN IF NOT EXISTS`, constraints are guarded by a lookup
against `pg_constraint`, and the backfills are scoped so they cannot overwrite
work done since.

## Order

| # | File | What it does |
|---|------|--------------|
| — | `../data-quality-summary.sql` | **Run first.** Counts per rule. Read-only. |
| — | `../data-quality-report.sql` | The offending rows, if the summary is not clean. Read-only. |
| 1 | `001_camp_trust_fields` | Trust + provenance columns on `camps` and `camp_sessions`, per-field confidence, the `camp_trust` rollup view, and the 2026 backfill |
| 2 | `002_camp_sources` | `camp_sources` — the pages we extract from, seeded from `camps.website_url` |
| 3 | `003_camp_updates` | `camp_updates` staging queue + `apply_camp_update()` |
| 4 | `004_validation_constraints` | Hard `CHECK` constraints on ages, price, dates, coordinates |
| 5 | `005_email_signups` | `email_signups` — the camp-updates email list. Independent of 1-4. |
| 6 | `006_camp_notify_requests` | `camp_notify_requests` — per-camp "notify me when the dates are posted". Independent of 1-5. |
| 7 | `007_camp_locations` | `camp_locations` + `camp_sessions.location_id` — where each session runs. Backfills one site per geocoded camp. |
| 8 | `008_camp_submissions` | `camp_submissions` + `camp_updates.submission_id` — dates a camp sends through `/camps/[id]/update`. Replaces `apply_camp_update()` so an approved submission publishes as `camp_confirmed`. Needs 003 and 007. |

Roll back in reverse: **004 → 003 → 002 → 001**. 003 must come down before 002
(`camp_updates.source_id` references `camp_sources`). 005 stands alone and can
be applied or rolled back at any point.

001–003 can each be applied independently, but 003 needs 002 for its foreign
key, and the whole set is one feature — apply all four.

## What rolling back costs

`down` scripts drop columns and tables, and dropping a column discards its data.

| Rolling back | Loses |
|---|---|
| 008 | **Every submission's contact details.** Its proposals stay in `camp_updates`; `apply_camp_update()` goes back to 003's. |
| 006 | **Every notify request.** Unreproducible — export first. |
| 005 | **Every signup.** Unreproducible — export the table first. |
| 004 | Nothing. Drops rules, keeps data. |
| 003 | Every pending/approved/rejected proposal and its review notes. Rows already applied live in `camps`/`camp_sessions` and are safe. |
| 002 | Every recorded fetch outcome, content hash and crawl note. Re-running `up` re-seeds homepages only. |
| 001 | Every `verification_status`, `last_verified_at`, `source_url` and confidence score. The 2026 backfill is reproducible; **human review decisions are not.** |

## Verification status

`camps` and `camp_sessions` each carry their own `verification_status`:

| Value | Meaning |
|---|---|
| `unverified` | No extraction has touched this row for its `season_year`. The state all 108 existing camps are in for 2027. |
| `auto` | Extracted and published without human review. |
| `human_checked` | A reviewer approved it. |
| `camp_confirmed` | The camp itself confirmed it, by email or phone. |

Both tables carry it because the session is what a parent acts on. A camp can
have one confirmed week and five that are last year's guesses, and a single
camp-level badge cannot say that.

## Publishing a staged change

Nothing in `camp_updates` reaches parents until it is published. Review sets the
status; `apply_camp_update()` does the write:

```sql
-- Look at what is waiting.
SELECT id, camp_id, target_table, change_type, proposed, current_values, validation
  FROM camp_updates
 WHERE status IN ('pending', 'needs_review')
 ORDER BY extracted_at;

-- Approve one. reviewed_by is what makes the published row 'human_checked'
-- rather than 'auto', so put a real name in it.
UPDATE camp_updates
   SET status = 'approved', reviewed_at = now(), reviewed_by = 'sharon'
 WHERE id = '…';

-- Publish it.
SELECT apply_camp_update('…');
```

`apply_camp_update` returns `'applied'`, or `'superseded'` if the live row
changed between extraction and approval — in which case nothing is written and
the proposal records what moved. It raises if the row is not `approved`, or if
it proposes a column that cannot be written (`id`, `created_at`, `updated_at`,
or a generated column such as `season_year`).

The function is `SECURITY DEFINER` and granted only to `service_role`. Both new
tables have RLS enabled with **no policies**, the same pattern as
`email_signups`: every read and write goes through the server's service-role
key, and the anon key the browser carries can see nothing.

## Validation rules

Thresholds live in [`src/lib/validation/campData.ts`](../../src/lib/validation/campData.ts),
which is canonical. They are duplicated in `004` and in the report queries
because SQL cannot import TypeScript — change them in all three.

The split that matters:

- **Hard `CHECK` constraints** (in 004) reject only what is impossible: ages
  outside 0–99, `min_age > max_age`, negative prices, `end_date` before
  `start_date`, a session longer than 120 days, half a coordinate, or
  coordinates outside the Richmond service area.
- **Warnings** (in the validator) route a row to `needs_review` instead of
  rejecting it. Ages outside 3–18, a price of 0, a price outside $25–$2,500, or
  dates outside the season window are all warnings.

Three deliberate non-rules, each one a real camp in the current data:

1. **"Dates within summer 2027" is not a constraint.** All 416 existing
   sessions are 2026; a hard 2027 window would reject the entire dataset. The
   extractor checks dates against the target `season_year` instead, and the
   year is passed in rather than inferred — "these 2026 dates were extracted as
   2027 data" is precisely the failure being hunted, and inferring the year
   would hide it.
2. **"Ages 3 to 18" is not a constraint.** Jacob's Chance Summer Camps serves
   people with disabilities and publishes sessions for ages 8–40 and 10–40.
   That is correct data about a real camp. A hard 3–18 rule would reject it or
   force us to misstate who the camp serves.
3. **Price 0 is allowed.** Let's Grow, Henrico! is a genuinely free county
   program. `price IS NULL` ("unknown") and `price = 0` ("free") are different
   claims, and the schema keeps them different.

The service area is the bounding box of a **50-mile** circle around downtown
Richmond (37.5407, -77.4360). 50 is not arbitrary — it is the widest radius the
search pill offers (`RADIUS_OPTIONS` in `src/lib/v2/usePillState.ts`), so a
parent can ask for camps that far out and anything stored has to be able to
answer. It reaches Ashland (~16 mi), Petersburg and Pamplin Historical Park
(~25 mi) with room to spare. The farthest camp currently in the directory is
Pamplin at 24.6 mi, so the 25–50 mi band is empty today and has headroom.

## State as of 2026-11-20

Taken from the live database, not from these files:

- **108 camps**, **416 sessions**, all sessions dated 2026.
- `data-quality-summary.sql` returns **zero errors** — which is why 004's
  constraints go in fully validated rather than as `NOT VALID`.
- Warnings: 4 age (Jacob's Chance), 3 free-price (Let's Grow, Henrico!),
  45 missing price, 12 missing `min_age`, 17 missing `max_age`,
  11 camps without coordinates, 44 camps whose `image_url` is hotlinked from an
  external host rather than the `camps_images` bucket.
- The SQL in this directory has **not been run against any database.** It is
  syntax-checked against Postgres's own parser (libpg_query — all statements and
  all plpgsql bodies parse), but applying it is a deliberate step for whoever is
  ready to take it.
