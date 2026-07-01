# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- Teacher dashboard "My Students" section — full-width panel below the dashboard grid showing each active student package with student name, remaining/total classes, progress bar, lesson duration, purchase date, price per class, and total paid; sorted by fewest remaining classes first
- `src/components/teacher/TeacherStudentsView.tsx` — new component powering the student package view
- `CONTEXT.md` at repo root — domain glossary pinning canonical terms (Package, Remaining Classes, Active Package, Student Name, Platform Fee, Pending Balance)
- `docs/testing-stripe-payments.md` — local Stripe payment testing guide covering prerequisites, test card numbers, webhook setup, and common gotchas
- `supabase/.temp/` added to `.gitignore` to prevent auto-generated CLI files from being committed
- Internal VitePress doc site under `docs/` — covers architecture, database schema, edge functions, auth flow, payments, lesson lifecycle, dev patterns, and local development with Docker
- `npm run docs:dev` script to spin up the doc site locally
- `npm run local:*` scripts (`local:supabase`, `local:functions`, `local:start`, `local:stop`, `local:cleanup`) for running the full stack locally via Docker without memorising raw Supabase CLI commands
- `docs/.vitepress/cache` added to `.gitignore`

### Changed
- `useTeacherPackages` hook now filters to active packages with `remaining_classes > 0` and sorts by fewest remaining classes ascending (previously returned all packages unfiltered)
- `docs/testing-stripe-payments.md` Stripe Connect prerequisite corrected — `purchase-package` rejects with 400 if the teacher has no `stripe_connect_id`, so Connect must be completed before purchase
- `CLAUDE.md` updated to reference the internal docs site and point to `docs/.vitepress/config.ts` for sidebar changes

### Fixed
- `TeacherStudentsView` student name fetch now guards against stale in-flight responses (cancelled flag) and logs Supabase errors instead of silently dropping them
