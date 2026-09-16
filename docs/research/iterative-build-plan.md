# Iterative build plan: teacher and student calendar

A plan for building the calendar feature from the wayfinder map (#21) in small, shippable steps. Each iteration is one PR, teaches one concept, and leaves `main` working.

Inputs: the map in issue #21, open tickets #25 to #31, and the three research findings (`docs/research/recurrence-expansion.md`, `docs/research/ical-feed.md`, `docs/research/calendar-rendering-library.md`).

## 1. Why this is less scary than it looks

The feature looks like one big thing. It is really nine small things, and most of them are read-only or touch one table.

- The rendering problem is solved. Schedule-X is chosen. You feed it events and it draws the grid, the half-hour lines, and the month view. You never write a grid.
- The hardest logic (turning weekly rules into real dates across DST) lives in one SQL function, `expand_availability()`. The client only displays what SQL returns. You do not write date math in TypeScript.
- The booking rules are additions to a function you already have, `book_lesson_atomic`. You add checks; you do not rewrite it.
- The iCal feed is a single Edge Function that returns text. Its shape is already decided.
- Iterations 1 and 3 are read-only. Iteration 2 adds one table with a form. Nothing breaks booking until iteration 4, and that change is one migration.
- The lesson request flow and the iCal feed are independent of everything else. They can wait, or be skipped for v1.

## 2. Iterations

Sizes: S is a day or less, M is two to three days, L is a week. All are estimates for one developer working with Claude Code.

### Iteration 1: Render existing lessons in a week view at `/calendar`

**Goal:** Show the lessons you already have on a Schedule-X week grid, with no new backend.

**What the user sees:** A new "Calendar" link in the header. `/calendar` shows this week, Sunday to Saturday, with each lesson as a coloured block showing the other person's name and the time range. Today, previous, and next buttons work. A corner label shows the viewer's timezone and offset.

**Touches:**
- `package.json`: add `@schedule-x/calendar`, `@schedule-x/react`, `@schedule-x/theme-default`, and the pinned `temporal-polyfill`.
- New `src/pages/CalendarPage.tsx` and `src/components/calendar/LessonCalendar.tsx`.
- New `src/components/calendar/LessonEventBlock.tsx` (the custom `timeGridEvent` component).
- `src/App.tsx`: add the `/calendar` route inside `ProtectedRoute`.
- `src/components/layout/Header.tsx`: add the link.
- Reads from `useLessons()` in `src/hooks/useLessons.ts` and `useUserProfile()` in `src/hooks/useUser.ts`. No changes to either.

**Concept to learn: instants versus wall time.**
`lessons.scheduled_at` is a `timestamptz`. That is an instant, a single point on the world's timeline, stored in UTC. "3 PM" is wall time; it only means something once you name a timezone. Schedule-X wants `Temporal.ZonedDateTime`, which is an instant plus a zone. You convert with one line: `Temporal.Instant.from(iso).toZonedDateTimeISO(viewerTz)`. The viewer's zone comes from `users.timezone` via `useUserProfile()`, not from the browser, matching what `LessonsPage.tsx` already does.

**Done when:**
- [ ] `/calendar` renders the same lessons `/lessons` lists, on the right days and hours.
- [ ] Changing your timezone in `/settings` moves the blocks and updates the corner label.
- [ ] Previous, next, and Today navigate correctly.
- [ ] A lesson at 23:30 in your zone does not jump to the wrong day.
- [ ] `npm run build` and `npm run lint` pass.

**Size:** M. **Depends on:** nothing (library decided in #22).

### Iteration 2: Availability rules table and Set availability modal (teacher only)

**Goal:** Let a teacher save weekly availability rules; nothing reads them yet except a list.

**What the user sees:** Teachers see a "+ Create" button on `/calendar` that opens a Set availability modal: weekday, start time, end time, repeat "Always" or "Until" a date, with a small note that "Always" means a rolling 3 months. Saved rules appear in a plain list under the calendar. Students see no button.

**Touches:**
- New migration `supabase/migrations/<timestamp>_add_availability_rules.sql`: table `availability_rules` (see the schema sketch in `recurrence-expansion.md` section 1.4), RLS so a teacher can only read and write their own rows, and `teacher_profiles.min_notice_hours` (12 or 24).
- `src/types/database.ts`: add the new table types.
- New `src/hooks/useAvailability.ts` with `useAvailabilityRules()` and `useCreateAvailabilityRule()`.
- New `src/components/calendar/SetAvailabilityModal.tsx` using React Hook Form and Zod, same pattern as `src/components/lessons/BookingModal.tsx`.
- `CONTEXT.md`: add Availability Rule, Availability Window, Exception.

**Concept to learn: storing wall time plus a zone name.**
A rule like "Tuesdays 13:00 to 16:00" is not an instant. It repeats, and it must survive DST. So you store `start_time time`, `end_time time`, and `timezone text` (an IANA name like `Europe/Berlin`), never a UTC timestamp. The form submits the `HH:MM` strings as typed. No conversion happens in the browser. Postgres turns these into instants later, in iteration 3.

**Done when:**
- [ ] A teacher can add a rule and see it listed after reload.
- [ ] A student cannot insert into `availability_rules` (test in Supabase Studio with the student's JWT, or via RLS test).
- [ ] The form rejects end before start and shows a Zod error.
- [ ] `supabase db reset` applies the migration cleanly.

**Size:** M. **Depends on:** #26 (data model, min notice setting).

### Iteration 3: `expand_availability()` and green windows on the grid

**Goal:** Turn rules into real windows in SQL and shade them green on the calendar.

**What the user sees:** The teacher's own `/calendar` shows green background bands where they are available, for the visible week. Nothing is bookable yet.

**Touches:**
- New migration `supabase/migrations/<timestamp>_add_expand_availability.sql`: the `STABLE` SQL function from `recurrence-expansion.md` section 1.4, plus `GRANT EXECUTE` to `authenticated`.
- `src/hooks/useAvailability.ts`: add `useExpandedAvailability(teacherId, from, to)` calling `supabase.rpc("expand_availability", {...})`.
- `src/components/calendar/LessonCalendar.tsx`: map the rows to Schedule-X `backgroundEvents` (plain `start` and `end`, no `rrule`).

**Concept to learn: `STABLE` SQL functions called through PostgREST.**
Supabase exposes every SQL function at `/rpc/<name>`. If the function is marked `STABLE` (reads but never writes), it can be called with GET and its result rows can be filtered and ordered like a table. React Query caches it like any other query. This means the calendar and the booking check share one expander, so what you see is exactly what booking will accept. The client never expands rules itself, because Postgres and date-fns-tz disagree at DST gaps.

**Done when:**
- [ ] A "Tuesdays 13:00 to 16:00" rule shows a green band each Tuesday of the visible week.
- [ ] Set your viewer timezone to a different zone than the rule; the band shifts by the right offset.
- [ ] Navigate 4 months ahead; an "Always" rule stops at the 3-month horizon.
- [ ] Run the function directly in SQL for the week of 2026-03-29 in `Europe/Berlin` and confirm no window has `ends_at <= starts_at`.

**Size:** M. **Depends on:** #26.

### Iteration 4: Fit, overlap, and notice checks in `book_lesson_atomic`

**Goal:** The database refuses bookings that do not fit availability, overlap another lesson, or come too soon.

**What the user sees:** The existing free-form `BookingModal.tsx` still works, but now shows a clear error if the picked time is outside availability, collides with a lesson, or is inside the minimum notice period.

**Touches:**
- New migration `supabase/migrations/<timestamp>_booking_rules.sql`: `CREATE OR REPLACE` of `book_lesson_atomic` (defined in `supabase/migrations/20260126190606_remote_schema.sql`). Read `duration_minutes` from `packages`, then add three `IF NOT ... RAISE EXCEPTION` blocks: fit inside one `expand_availability` window, no overlap with non-cancelled `lessons` for that teacher, and `p_scheduled_at >= now() + min_notice_hours`.
- `src/components/lessons/BookingModal.tsx`: surface the RPC error message (it already catches errors, so this may be zero lines).
- Seed data in `supabase/seed.sql` if you want a teacher with rules for local testing.

**Concept to learn: atomic checks inside a plpgsql function.**
`book_lesson_atomic` runs as one transaction. It locks the package row with `FOR UPDATE`, checks, inserts, and updates. If any `RAISE EXCEPTION` fires, the whole thing rolls back and the client gets the message. Putting the rules here, not in React, means a second tab, a stale calendar, or a hand-crafted request all hit the same wall. The overlap check is a plain interval comparison because both sides are instants.

**Done when:**
- [ ] Booking inside a green window succeeds.
- [ ] Booking 15 minutes before the window ends with a 30-minute package fails with the fit message.
- [ ] Booking on top of an existing scheduled lesson fails; on top of a cancelled one succeeds.
- [ ] Booking 6 hours from now fails when `min_notice_hours` is 12.
- [ ] A teacher with zero rules cannot be booked at all.

**Size:** M. **Depends on:** #27 (rule details and rollout).

### Iteration 5: Students book from a slot

**Goal:** Replace date and time dropdowns with clicking a green slot on a calendar.

**What the user sees:** On `/teachers/:teacherId`, a week calendar shows that teacher's availability in the student's timezone. Clicking inside a green band opens the existing `BookingModal` with date and time pre-filled. On the student's own `/calendar`, "+ Create" asks which Active Package, then overlays that teacher's availability the same way. Slots too short for the package's duration are greyed out.

**Touches:**
- `src/pages/TeacherDetailPage.tsx`: embed `LessonCalendar` in read-only mode with `onClickDateTime`.
- `src/components/lessons/BookingModal.tsx`: accept an optional `initialDateTime` prop; keep the dropdowns as fallback.
- `src/components/calendar/LessonCalendar.tsx`: add `onSlotClick` and a `packageDuration` prop to grey out short windows.
- New `src/components/calendar/PickPackageModal.tsx` using `usePackages()` from `src/hooks/usePackages.ts`.

**Concept to learn: `Temporal.ZonedDateTime` from a click.**
Schedule-X's `onClickDateTime` hands you a `Temporal.ZonedDateTime` in the viewer's zone. You round it down to the nearest 30 minutes, then call `.toInstant().toString()` to get the ISO string the RPC wants. That is the same shape `useBookLesson` already sends. You never build a `new Date(y, m, d, h, mi)` from wall-clock parts; that is the trap the research warned about.

**Done when:**
- [ ] Clicking a green slot on the teacher page opens the modal with the right time in both the student's and teacher's zones.
- [ ] Clicking outside a green band does nothing or shows a hint.
- [ ] A 45-minute package cannot pick a 30-minute-only window.
- [ ] Booking from the student's `/calendar` via "+ Create" ends with a lesson block appearing.
- [ ] The old dropdown path still works when there is no click.

**Size:** L. **Depends on:** #27, #31 (prototype answers layout questions first).

### Iteration 6: Exceptions and edit scopes

**Goal:** Let a teacher remove or change one occurrence, this and following, or all, plus Reset availability.

**What the user sees:** Clicking a green band as a teacher opens a small dialog with Edit and Delete, each asking "This occurrence / This and following / All occurrences". A "Reset availability" button in the calendar toolbar clears everything after a confirm.

**Touches:**
- New migration: table `availability_exceptions (rule_id, occurrence_date)`, plus two plpgsql RPCs, `split_availability_rule` (this and following) and `reset_availability`.
- `supabase/migrations/<timestamp>_add_expand_availability.sql` already anti-joins exceptions; no change if you used the sketch.
- `src/hooks/useAvailability.ts`: add `useDeleteOccurrence`, `useSplitRule`, `useUpdateRule`, `useResetAvailability`.
- New `src/components/calendar/EditAvailabilityDialog.tsx`.

**Concept to learn: rule plus exceptions, keyed on a local date.**
"Not this Tuesday" is stored as `(rule_id, '2026-10-06')`, a date in the teacher's zone, not an instant. "This and following" sets `until` on the old rule to the day before and inserts a new rule from that date. "All" is a plain update. Because the expander runs at query time, these small row changes show up correctly on every calendar without recomputing anything. Booked lessons are never touched.

**Done when:**
- [ ] Deleting one occurrence removes only that green band.
- [ ] "This and following" with a new end time changes that week onward and leaves earlier weeks alone.
- [ ] "All" changes every week, and earlier exceptions still apply.
- [ ] Reset removes all bands, and existing lesson blocks remain.
- [ ] A booked lesson inside a removed occurrence still appears (product choice from #26).

**Size:** M. **Depends on:** #26.

### Iteration 7: Status filters and Month view

**Goal:** Add the Week/Month toggle and the Action required / Upcoming / Waiting / Completed / Other filters.

**What the user sees:** A Week/Month toggle. Month view shows per-day lesson chips (or counts, per #29); clicking a day jumps to that week. Filter chips above the grid hide or show lesson blocks by status; "Other" is off by default.

**Touches:**
- `src/components/calendar/LessonCalendar.tsx`: enable `createViewMonthGrid()` and a `monthGridEvent` custom component.
- New `src/components/calendar/StatusFilters.tsx` and a small pure helper `src/lib/lessonStatusGroup.ts` that maps a lesson plus the viewer's role to one of the five groups.
- `src/pages/CalendarPage.tsx`: hold filter state in `useState`, filter before passing events.

**Concept to learn: derived state and a pure mapping function.**
The filter groups are not stored anywhere. They are computed from `status`, `scheduled_at`, `now`, and the viewer's role. Writing that as a pure function in `src/lib/` means you can test it in isolation and reuse it in `LessonsPage.tsx` later. The calendar just receives the already filtered array; Schedule-X does not know filters exist.

**Done when:**
- [ ] Teacher sees a past `scheduled` lesson under Action required; student sees `pending_confirmation` there.
- [ ] Unchecking Completed hides confirmed lessons; Other is off by default and reveals cancelled ones.
- [ ] Month view shows the right chips per day and clicking a day opens that week.
- [ ] Filters persist while switching Week and Month.

**Size:** M. **Depends on:** #29 (what Month shows).

### Iteration 8: Lesson request flow (teacher to student)

**Goal:** A teacher proposes a time; the student accepts or declines.

**What the user sees:** Teacher clicks a green slot, picks a student with an Active Package, and sends a request. It shows as a dashed block on both calendars. The student gets an Accept / Decline choice; accepting creates a lesson through `book_lesson_atomic`, so all the rules from iteration 4 apply.

**Touches:**
- New migration: table `lesson_requests` (or a new lesson status, per #25), RLS, and an `accept_lesson_request` RPC that calls `book_lesson_atomic` and marks the request.
- New `src/hooks/useLessonRequests.ts`.
- New `src/components/calendar/SendRequestModal.tsx` and `RequestActions.tsx`.
- `src/components/calendar/LessonEventBlock.tsx`: dashed style for requests.
- Reads `useTeacherPackages()` from `src/hooks/usePackages.ts` for the student picker.

**Concept to learn: modelling a proposal separately from the thing it proposes.**
A request is not a lesson. It does not deduct a Remaining Class until accepted (if #25 decides so), it can expire, and it can be declined. Keeping it in its own table means `lessons` stays clean and every existing query keeps working. The accept RPC reuses `book_lesson_atomic`, so you get fit, overlap, and notice checks for free.

**Done when:**
- [ ] Teacher cannot send a request without availability or to a student without an Active Package.
- [ ] Both calendars show the pending request.
- [ ] Accept creates a lesson and deducts one class; Decline removes the request.
- [ ] Accepting a request whose slot was booked in the meantime fails with the overlap message.

**Size:** L. **Depends on:** #25.

### Iteration 9: iCal feed

**Goal:** A per-user secret URL that Apple and Google Calendar can subscribe to.

**What the user sees:** In `/settings`, a "Calendar feed" card with an `https://` and a `webcal://` URL, a Copy button, a Regenerate button, and a note that Google may take up to a day to refresh.

**Touches:**
- New migration: table `calendar_feed_tokens (user_id, token_hash, created_at)` with RLS, plus a small RPC `set_calendar_feed_token(p_hash)`.
- New `supabase/functions/calendar-feed/index.ts` following the shape in `ical-feed.md` section 3 and the style of `supabase/functions/confirm-lesson/index.ts` (Deno `serve`, service-role client, early returns).
- `supabase/config.toml`: add `[functions.calendar-feed]` with `verify_jwt = false`.
- New `src/hooks/useCalendarFeed.ts` and a card in `src/pages/SettingsPage.tsx`.

**Concept to learn: secret-token URLs and hashed storage.**
Calendar apps cannot send headers, so the secret has to be in the URL. Treat it like a password: generate 32 random bytes in the browser, show the user the base64url string once, and store only its SHA-256 hash. The Edge Function hashes the incoming path segment and looks up the hash. Regenerate deletes the row and inserts a new hash, so the old URL 404s. Return 404 for both unknown and malformed tokens so nobody can probe.

**Done when:**
- [ ] `curl` on the local function URL with a valid token returns `text/calendar` with one `VEVENT` per booked lesson.
- [ ] A cancelled lesson appears with `STATUS:CANCELLED` and a "CANCELLED:" summary prefix.
- [ ] After Regenerate, the old URL returns 404 and the new one works.
- [ ] Subscribing in Apple Calendar shows the lessons at the right local times.
- [ ] `curl` with no headers at all works (confirms the gateway needs no `apikey`).

**Size:** M. **Depends on:** #28.

## 3. How to work each iteration with Claude Code

Repeat this loop once per iteration. It is deliberately slow at the start and fast at the end.

1. **Branch.** `git checkout main && git pull && git checkout -b calendar/iter-N-short-name`.
2. **Check the map.** Run `/wayfinder` and confirm the ticket this iteration depends on is closed with a decision. If it is not, decide it first with `/grilling` on that ticket. Do not start coding against an open decision.
3. **Get a ticket.** Run `/to-tickets` for this iteration so the scope is written down in the tracker, with the "done when" list from this file pasted in.
4. **Ask for the concept before code.** Prompt: "Explain <concept from this iteration> in the context of this repo, in under 20 lines, no code yet." Read it. Ask follow-up questions until you could explain it to someone else.
5. **Ask for the smallest diff.** Prompt: "Implement only the ticket. Smallest possible diff. Name every file you touch before you edit." Reject anything that reaches beyond the iteration.
6. **Run it locally.** `supabase start`, then `supabase db reset` if a migration was added, then `npm run dev`. Walk the "done when" list by hand. Use Supabase Studio at the local URL from `supabase status` to inspect rows.
7. **Ask for a walkthrough.** Prompt: "Walk me through the diff file by file. For each hunk say what it does and why it is needed." Ask "what would break if I removed this?" on anything you do not follow.
8. **Lint, build, PR.** `npm run lint && npm run build`, commit, open a PR to `main`, and let CodeRabbit review. Use `/check-my-pr` for the comments. Merge, then delete the branch.
9. **Update the docs.** Add or extend a page in `docs/` (for example `docs/lessons.md` or a new `docs/calendar.md`) and register it in `docs/.vitepress/config.ts`. Add a line to `docs/CHANGELOG.md` with `/update-changelog`.

Keep one iteration per PR. If a PR grows past the "touches" list above, split it.

## 4. Concepts glossary

| Concept | One-line definition | First appears |
|---|---|---|
| Instant vs wall time | An instant is a point on the world timeline (`timestamptz`, UTC); wall time is "13:00" and needs a zone to mean anything. | Iteration 1 |
| `Temporal.ZonedDateTime` | An instant paired with an IANA zone; what Schedule-X uses for event start and end and for click callbacks. | Iteration 1 |
| Custom event component | A React component Schedule-X renders inside each event block, receiving `calendarEvent`. | Iteration 1 |
| IANA timezone name | A string like `Europe/Berlin` that carries DST rules, unlike an offset like `+01:00`. | Iteration 2 |
| Row Level Security (RLS) | Postgres policies that decide which rows a JWT can read or write; how "teacher only" is enforced. | Iteration 2 |
| `STABLE` SQL function via PostgREST | A read-only SQL function exposed at `/rpc/<name>` and callable with `supabase.rpc()`; results filter like a table. | Iteration 3 |
| Background events | Non-interactive shaded bands in Schedule-X, used here for availability windows. | Iteration 3 |
| Rolling horizon | "Always" rules expand only up to `now() + 3 months`, computed inside the function. | Iteration 3 |
| Atomic plpgsql RPC | A function that locks, checks, and writes in one transaction; `RAISE EXCEPTION` rolls everything back. | Iteration 4 |
| Rule plus exceptions | Recurrence stored as a weekly rule and a list of removed local dates, not as materialised rows. | Iteration 6 |
| Derived state | Values computed from other state at render time (status groups) rather than stored. | Iteration 7 |
| Secret-token URL | A URL containing a random secret, stored only as a SHA-256 hash, regenerable to revoke. | Iteration 9 |
| `verify_jwt = false` | Supabase setting letting an Edge Function accept requests with no Authorization header; the handler must verify the caller itself. | Iteration 9 |

## 5. What to skip or defer

From the map's "Not yet specified" list (fog), each one line:

- Notifications for requests, bookings, and reminders: defer; ship the calendar without email or in-app alerts.
- Narrow-screen layout of the week grid: defer; Schedule-X's day view is the cheap fallback when a decision is made.
- Rescheduling a booked lesson from the calendar: defer; cancel and rebook covers it for v1.
- Buffer time between lessons and a per-teacher booking horizon: defer; the 3-month horizon and zero buffer are assumed.
- Rollout for lessons booked free-form before availability existed: decide in #27 before iteration 4, but existing lesson rows need no migration.
- Admin dashboard visibility of calendars: defer; `AdminDashboardPage.tsx` stays list-based.

From the map's "Out of scope" list:

- "View Tips" helper link: skip.
- Vacation mode: skip; a teacher can delete occurrences or reset availability.
- Teacher "view as student" preview toggle: skip.
- Teachers booking directly on behalf of a student: skip; the lesson request in iteration 8 replaces it.

Also skip for v1 (from the research findings): windows crossing local midnight, overlapping rules for one teacher, rrule.js, and any client-side expansion with `fromZonedTime`.
