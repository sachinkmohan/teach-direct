# Handoff: Calendar feature, iteration 1 (render lessons in week view)

## Repo & context

- Repo: `/Users/sacmon/git/github/teachdirect-web` (Learn From A Tutor — React 19 + TS + Vite + Supabase).
- Current branch: `LFT-24` (user explicitly chose to continue here rather than a fresh per-iteration branch off `main`, deviating from the build plan's stated "one branch per iteration" practice — this was a conscious call, not an oversight).
- Feature being built: the calendar (wayfinder map **GitHub issue #21** in `sachinkmohan/teach-direct`), per `docs/research/iterative-build-plan.md`. Currently on **Iteration 1**: render existing lessons in a week view at `/calendar`, read-only, no new backend.
- Ticket for this iteration: **#33** (linked as a sub-issue of #21, labels `wayfinder:task` + `ready-for-agent`, assigned to the user). Has the full PRD and a comment logging the FullCalendar version decision below.
- This repo runs under a **"Learning mode"** section in `CLAUDE.md` — the developer is deliberately building this feature themselves to grow senior-level skills. Read that section before doing anything else; it governs how work should proceed (explain-before-code, developer writes the code, smallest diff, one decision per session, teach-back before merge, learning log, etc.). It was edited twice this session — see "CLAUDE.md state" below.

## What's been decided (don't re-litigate these)

1. **FullCalendar pinned to `6.1.21` across all four packages** (`@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`) — NOT v7, despite issue #22's revised decision naming v7. Verified directly against the npm registry: `timegrid`/`interaction` have no stable v7 release (only `7.0.0-rc.0`), and installing `core@7.1.0` with `timegrid@6.1.21` fails outright with a real `ERESOLVE` peer-dependency error (reproduced and shown to the user). Logged as a comment on ticket #33. **Not yet reflected in #21's own "Decisions so far" log** — worth considering whether to update that too.
2. **Timezone conversion lives in the component (`LessonCalendar`), not the page (`CalendarPage`)** — matches the existing `LessonsPage` → `LessonCard` pattern in this codebase (page fetches + passes `userTimezone` down as a prop; component does the actual time handling).
3. **No manual `Temporal` conversion needed**, contrary to what the build-plan doc assumes (it was written for Schedule-X, not FullCalendar). FullCalendar's `timeZone` prop + raw UTC ISO strings for event `start`/`end` does the positioning automatically.
4. **The trap for this library**: `LessonEventBlock` must read `arg.timeText` (FullCalendar's own pre-formatted string, aware of the configured `timeZone`) rather than deriving a time label from `arg.event.start.getHours()` etc. — that `Date` object only reflects the browser's local zone or UTC, not the viewer's stored profile zone. This was explained to the user with a concrete numeric example (Asia/Kolkata vs. America/New_York) during teach-back.
5. **An explicit override clause was added to `CLAUDE.md`'s Learning mode section** (see diff in git history / current file) — the developer can say something like "take over, build this for me" for a specific file, and Claude will write it directly, but must say plainly, per file, that this skips the write-it-yourself step. This does NOT relax any other rule (still smallest diff, still no unrelated refactors). It was added at the user's explicit request, after some earlier back-and-forth where the user tried removing the "developer writes the code" rule from `CLAUDE.md` directly to get around it — that removal was flagged and reverted/restored before the proper override clause was added instead.

## CLAUDE.md state

The Learning mode section currently has, in order: Explain before code → **The developer writes the code...** (restored) → **Explicit override** (newly added) → Smallest diff → One decision per session → ADRs → Teach-back before merge → Learning log → Practices → Order. Read the live file rather than trusting this summary for exact wording.

## Files changed this session (none committed yet — working tree is dirty)

- `package.json` / `package-lock.json` — FullCalendar deps added, pinned to `6.1.21`.
- `CLAUDE.md` — override clause added (and the deleted "developer writes code" line restored).
- `src/App.tsx` — `/calendar` route added inside `ProtectedRoute`, imports `CalendarPage`.
- `src/pages/index.ts` — `export { CalendarPage } from "./CalendarPage"` added.
- `src/pages/CalendarPage.tsx` — new. Fetches `useLessons()` + `useUserProfile()`, computes `userTimezone`/`userRole`, renders `<LessonCalendar lessons userTimezone userRole />`.
- `src/components/layout/Header.tsx` — "Calendar" nav link added next to Dashboard (authenticated-only section).
- `src/components/calendar/LessonCalendar.tsx` — new. Has the pure `lessonToEvent(lesson, userRole)` mapping function (no timezone math — just picks the other party's name and computes `end` via `addMinutes`), and the `<FullCalendar>` element (`timeGridWeek`, `firstDay: 0`, `timeZone={userTimezone}`, `eventContent={LessonEventBlock}`, `nowIndicator`).
- `src/components/calendar/LessonEventBlock.tsx` — new. Custom `eventContent` renderer; status-colored block using `arg.timeText` + `arg.event.extendedProps`.
- `docs/local-dev.md` — new "Giving a Test Student a Package" subsection (SQL insert into `packages`, using the seeded local test users: John the teacher `11111111-1111-1111-1111-111111111111`, Jane the student `22222222-2222-2222-2222-222222222222`).

**Everything in `src/` above was written by Claude directly under the explicit-override clause, not by the developer** — this matters because the Learning mode rules treat that as a notable deviation, and the teach-back step (see below) exists specifically to compensate for that.

Four unrelated items also exist in git status but weren't touched this session: `docs/research/git-diverged-branch-explained.md` (untracked, pre-existing).

Separately filed: **ticket #34** — "Codify formatting convention with a checked-in Prettier config" (`ready-for-human`, standalone chore, NOT linked to #21) — came out of discovering the dev's editor reformats whole files (adds semicolons) on save, which doesn't match this repo's no-semicolon convention and was initially caught in the `/calendar` route diff.

## Verification status

- `npx tsc -b --noEmit` — clean. (Note: plain `tsc --noEmit` at the repo root is a no-op here — root `tsconfig.json` has an empty `files` array and uses project references, so it silently checks nothing. Always use `tsc -b --noEmit`.)
- `npm run build` — succeeds.
- `npm run lint` — clean on every file touched this session. There ARE 8 pre-existing lint errors, but they're all inside `docs/.vitepress/cache/deps/` (a gitignored VitePress build cache directory, not part of the repo) — unrelated, pre-existing, not introduced here.
- **NOT yet verified**: the user has NOT fully walked ticket #33's "done when" checklist (timezone change moving blocks, prev/next/today, the 23:30-edge-case day boundary). They did get as far as seeing the calendar render and asked about seeding a test package for booking — so some manual spot-checking happened, but the full checklist is unconfirmed.
- Local Supabase: confirmed actually running (REST API responded) even though `supabase status` claimed some services were stopped — don't trust that command's output at face value, hit the REST URL directly to check (`http://127.0.0.1:54321/rest/v1/...`).

## Teach-back — IN PROGRESS, not complete

Per the Learning mode rule, Claude must ask 5 questions (3 recall, 1 prediction, 1 redesign) before this PR merges, and record results in `docs/research/learning-log.md`.

Status:
1. **Recall Q1** (where does UTC→wall-time conversion happen) — user answered, partially correct (said "timezone fetched from hook" but missed that the `timeZone` prop on FullCalendar is the actual delegation mechanism). Corrected by Claude.
2. **Recall Q2** (why `arg.timeText` not `arg.event.start.getHours()`) — user didn't understand initially; Claude gave a concrete worked example (Asia/Kolkata block drawn at 11:30 PM vs. a wrongly-derived "2:00 PM" label). **Unclear if the user has now confirmed they follow this** — their very next message was a related-but-different question about `arg` itself, not explicit confirmation on Q2.
3. **Recall Q3** (which prop decides teacher-name vs student-name) — user answered, mostly correct; Claude sharpened the distinction between where `userRole` is *computed* (`CalendarPage`) vs. where it's *consumed* to pick a name (`LessonCalendar`'s `lessonToEvent`).
4. **Prediction Q4** (what happens on screen if `userProfile` hasn't loaded yet when `CalendarPage` first renders) — **NOT YET ASKED/ANSWERED** in this exact form, though related ground was partially covered via the `arg` follow-up tangent. Worth re-asking directly if it hasn't been explicitly answered.
5. **Redesign Q5** (how to reshape `LessonCalendar`'s props to support a read-only teacher-availability view on `TeacherDetailPage` in iteration 5, without duplicating the component) — **NOT YET ANSWERED**.

**Next step for teach-back: get explicit answers to Q4 and Q5, confirm Q2 is actually understood, then write the learning log entry** (see below — file may not exist yet, check `docs/research/learning-log.md`).

## Outstanding / next steps

1. Finish teach-back (Q4, Q5, confirm Q2 landed).
2. Write the `docs/research/learning-log.md` entry for this iteration (what was built, teach-back results, a short retro on "what did I not understand this time" — likely the `timeZone` delegation mechanism and the `Date`-object timezone trap, based on the answers above). Check whether this file exists yet; it may need to be created fresh.
3. Have the user actually walk ticket #33's full "done when" checklist locally (timezone change, prev/next/today, 23:30 edge case) before considering the iteration done.
4. Decide whether to commit the current working tree (nothing has been committed this session) and whether `LFT-24` is really the intended target branch, or whether to reconsider given the build plan's stated one-branch-per-iteration practice.
5. Consider updating issue #21's own "Decisions so far" log to reflect the FullCalendar v6.1.21 pin, not just the comment on #33.
6. Ticket #34 (Prettier config) remains open, unaddressed, not blocking.
7. Before merging, run `/check-my-pr` once a PR exists (per `CLAUDE.md`'s "Other Constraints": always fetch the CodeRabbit comments via the PR's git URL directly, never via `gh` commands, for that specific workflow).

## Suggested skills for the next session

- No specialized skill is strictly required to continue — this is mostly conversational continuation (finishing teach-back, then plain file edits the user does themselves).
- If/when a PR is opened for this iteration and CodeRabbit comments need handling: use the **`check-my-pr`** skill (and remember the `CLAUDE.md` rule to fetch the PR's git URL directly rather than `gh` commands for that specific task).
- If another open design decision comes up (e.g. anything from iteration 2+ in the build plan), the repo's own `/grilling` and `/domain-modeling` skills are the house convention for settling those one-at-a-time, per `CLAUDE.md`'s "Agent skills" section — don't settle more than one per session.
- If filing the next iteration's ticket: this session used the **`to-prd`** skill (there is no literal `/to-tickets` skill despite `CLAUDE.md`/build-plan text referencing that name — `to-prd` is what actually exists and was used).
