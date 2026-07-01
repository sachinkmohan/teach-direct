# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- Internal VitePress doc site under `docs/` — covers architecture, database schema, edge functions, auth flow, payments, lesson lifecycle, dev patterns, and local development with Docker
- `npm run docs:dev` script to spin up the doc site locally
- `npm run local:*` scripts (`local:supabase`, `local:functions`, `local:start`, `local:stop`, `local:cleanup`) for running the full stack locally via Docker without memorising raw Supabase CLI commands
- `docs/.vitepress/cache` added to `.gitignore`

### Changed
- `CLAUDE.md` updated to reference the internal docs site and point to `docs/.vitepress/config.ts` for sidebar changes
