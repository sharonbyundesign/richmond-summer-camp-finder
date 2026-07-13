# Contributing to Scouty

This repo works on a one-master model: `master` is the only permanent branch, it is always deployable, and every change reaches it through a pull request. Direct pushes to `master` are blocked by a repository rule — this applies to everyone, including admins.

## The workflow

1. **Start from fresh master.**
   ```bash
   git checkout master
   git pull
   git checkout -b your-branch-name
   ```
   Never branch off an old local copy — most merge conflicts start here.

2. **Keep branches small and short-lived.** One branch = one change (a feature, a fix, a chore). If a branch is more than a few days old or drifting far behind master, merge or close it rather than letting it grow.

3. **Push and open a PR into `master`.**
   ```bash
   git push -u origin your-branch-name
   ```
   Then use GitHub's "Compare & pull request" banner, or `gh pr create`.

4. **Wait for checks.** Vercel builds a preview deployment for every PR — use the preview link to review the change in a real browser before merging.

5. **Merge, then delete the branch.** GitHub offers branch deletion on the merge screen (or it happens automatically if auto-delete is enabled). Merged branches should not linger.

6. **Sync up after merging.**
   ```bash
   git checkout master
   git pull
   ```

## Branch naming

Short and descriptive, with an optional type prefix:

- `feat/filter-price-brackets`
- `fix/camp-image-fallback`
- `chore/update-deps`

## Working with coding agents (Claude Code, Cursor)

Agents follow the same rules as people:

- Start every agent session by pulling master and creating a new branch — never let an agent commit directly to `master` (the push will be rejected anyway).
- Agents may open PRs (via `gh`), but a human decides when to merge anything non-trivial.
- No force-pushes, ever. If an agent suggests one, stop and ask why.
- The `.claude/` directory is gitignored — local agent settings stay local.

## Environment and secrets

- Real credentials live only in `.env.local` (gitignored) and in Vercel's environment variables — never in code or commits.
- `.env.local.example` documents which variables are needed, with placeholder values only.
- This repo is public: assume everything committed is visible to the world, forever (git history included). When in doubt, leave it out.

## Vercel notes

- Merges to `master` deploy to production automatically.
- PR branches get preview deployments; the preview URL is posted on the PR.
- If a preview fails with a Git-author access error, check that the repo is still public and the commit email matches the author's GitHub account.

## Questions

Anything unclear or blocking — message Sharon. When the process fights you, we change the process, not the habit of using it.
