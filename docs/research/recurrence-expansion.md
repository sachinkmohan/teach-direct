# Research: expanding weekly recurrence rules with exceptions across DST

Resolves [#24](https://github.com/sachinkmohan/teach-direct/issues/24) (part of #21).
Researched 2026-09-16 against primary sources only (PostgreSQL manual and source, date-fns-tz source and issue tracker, rrule.js README and issue tracker, IANA tz theory). Version context: Supabase Postgres, `date-fns` 4.1, `date-fns-tz` 3.2.0 (checked in `package.json` and `node_modules`).

## TL;DR recommendation

1. **Expand in SQL, once, and treat it as the only source of truth.** A `STABLE` SQL function `expand_availability(teacher_id, from, to)` returns `(rule_id, occurrence_date, starts_at timestamptz, ends_at timestamptz)`. The booking RPC calls it for the fit check; the calendar calls it through PostgREST (`/rpc/expand_availability`, filterable like a table) and only *renders* the returned instants in the viewer's zone with `toZonedTime` / `formatInTimeZone`. The client never derives instants from wall-clock rules itself.
2. **Reason:** Postgres and date-fns-tz resolve *nonexistent* local times differently (verified below: 02:30 on 2026-03-29 in `Europe/Berlin` → Postgres `01:30Z`, date-fns-tz `00:30Z`), and date-fns-tz's answer for *ambiguous* times changed with the host machine's `TZ` in my runs. rrule.js's own README says its returned dates are floating and its tracker has a long history of DST-shift reports. Two expanders means two answers; the fit check would sometimes reject what the calendar showed.
3. **Exceptions and edits** key on the *teacher-local occurrence date* (a `date`), not on a `timestamptz`: "this occurrence" inserts `(rule_id, occurrence_date)` into an exceptions table; "this and following" sets `until = occurrence_date - 1` and inserts a new rule starting on `occurrence_date`; "all" updates the rule in place. Because expansion happens at query time from wall times, a future IANA rule change re-expands correctly on its own.

---

## 1. Postgres approach

### 1.1 Building timestamptz windows from wall-clock rules

Two building blocks, both in the manual:

- `timestamp without time zone AT TIME ZONE zone → timestamp with time zone` — "Converts given time stamp *without* time zone to time stamp *with* time zone, assuming the given value is in the named time zone." The zone "can be specified either as a text value (e.g., `'America/Los_Angeles'`) or as an interval". `timezone(zone, timestamp)` is the function-call equivalent.
  Source: https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT
- `date + time → timestamp` ("Adds a time-of-day to a date", e.g. `date '2001-09-28' + time '03:00' → 2001-09-28 03:00:00`) and `date + integer → date`; `EXTRACT(ISODOW …)` gives "Monday (1) to Sunday (7)", while `DOW` is "Sunday (0) to Saturday (6)".
  Source: https://www.postgresql.org/docs/current/functions-datetime.html (Table 9.32; EXTRACT field list)

So an occurrence of rule *r* on local date *d* is exactly:

```sql
(d + r.start_time) AT TIME ZONE r.timezone   -- starts_at, timestamptz
(d + r.end_time)   AT TIME ZONE r.timezone   -- ends_at,   timestamptz
```

Iterate `d` with `generate_series` over **`date`/`timestamp` values, not over `timestamptz`**. A step of `'1 day'` on `timestamp without time zone` cannot hit a DST transition, because that type has no zone. (The `timestamptz` form of `generate_series` does have a `timezone text` argument and the manual shows it stepping across the New York fall-back correctly — `04:00:00+00` before, `05:00:00+00` after — but we do not need it: we only need dates.)
Source: https://www.postgresql.org/docs/current/functions-srf.html

Related trap worth knowing: on `timestamptz`, `+ interval '1 day'` keeps "the local time of day … the same" whereas `+ interval '24 hours'` is literal, so the two differ across a transition (the manual's Denver example: `12:00-07 + 1 day → 12:00-06`, `+ 24 hours → 13:00-06`). Keeping the date arithmetic on `date` sidesteps this entirely.
Source: https://www.postgresql.org/docs/current/functions-datetime.html#OPERATORS-DATETIME-TABLE (intro text before Table 9.32)

### 1.2 What Postgres does with nonexistent and ambiguous local times

The manual does not spell this out (I searched `datatype.sgml` and the rendered pages for "ambiguous", "nonexistent", "gap", "twice"; nothing). The behaviour is defined by `DetermineTimeZoneOffset()` in the server source:

> It's an invalid or ambiguous time due to timezone transition. In a spring-forward transition, prefer the "before" interpretation; in a fall-back transition, prefer "after".

Source: https://github.com/postgres/postgres/blob/master/src/backend/utils/adt/datetime.c (function `DetermineTimeZoneOffsetInternal`)

Concretely:

| Local input (`Europe/Berlin`, 2026) | Situation | Postgres result | Displayed back in Berlin |
|---|---|---|---|
| `2026-03-29 02:30` | nonexistent (02:00→03:00) | uses the *before* offset, +01 → `01:30Z` | `03:30 CEST` |
| `2026-10-25 02:30` | ambiguous (03:00→02:00) | uses the *after* offset, +01 → `01:30Z` | `02:30 CET` (the second occurrence) |

No error is raised in either case. Consequences for windows:

- A window `02:00–04:00` on the spring-forward day expands to `01:00Z–02:00Z` (one real hour), and a window `02:30–02:45` collapses to `01:30Z–01:45Z`, which still exists but is 03:30–03:45 on the wall clock. Neither is wrong, but neither is what the teacher typed.
- A window `02:00–03:00` on the fall-back day: start `02:00` (ambiguous → after, +01) = `01:00Z`; end `03:00` (unambiguous, +01) = `02:00Z`. One hour, not the two the wall clock actually shows. Again silently "fine".
- A window whose `end_time` maps to an instant `<=` its `starts_at` (possible only around a gap) must be dropped; the sketch below does this.

Policy recommendation: **accept the Postgres resolution as the definition**, document it, and add a UI hint when a rule's start or end falls inside 01:00–03:59 in the teacher's zone (the only hours IANA transitions use in practice). Do not try to "fix" it in the client: see §2.

### 1.3 Other Postgres facts that shape the design

- "All timezone-aware dates and times are stored internally in UTC." So `lessons.scheduled_at timestamptz` is an instant; the fit check is a plain interval comparison.
  Source: https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES
- "PostgreSQL uses the widely-used IANA time zone data", the names are "obtained from configuration files stored under `.../share/timezone/`", and "For times in the future, the assumption is that the latest known rules for a given time zone will continue to be observed indefinitely far into the future." Store `timezone` as the IANA name (`users.timezone` already does, default `'UTC'`), never an abbreviation: "abbreviations represent a specific offset from UTC, whereas many of the full names imply a local daylight-savings time rule".
  Source: https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES
- IANA itself: "The tz database predicts future timestamps, and current predictions will be incorrect after future governments change the rules." Expanding at query time from wall times means a tzdata update on the Postgres side automatically moves future windows; pre-materialising `timestamptz` rows would not.
  Source: https://data.iana.org/time-zones/theory.html (section "Accuracy of the tz database")
- The manual recommends against `time with time zone` ("We do *not* recommend using the type `time with time zone`"); store the rule's `start_time`/`end_time` as plain `time` plus the IANA `timezone` column.
  Source: https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES
- `now()` / `CURRENT_DATE` are the transaction start time, so a horizon computed as `CURRENT_DATE + interval '3 months'` is stable within the booking transaction.
  Source: https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT
- PostgREST: functions are called at `/rpc/<name>`; "Functions callable via GET must not modify the database" (they must be `STABLE` or `IMMUTABLE`), and functions returning `SETOF`/`TABLE` "support the same filtering and ordering capabilities as standard tables and views". So the calendar can do `GET /rpc/expand_availability?p_teacher_id=…&p_from=…&p_to=…&order=starts_at`. Mark the function `STABLE` (it reads tables; it must not be `IMMUTABLE` because tzdata and rows change).
  Source: https://docs.postgrest.org/en/latest/references/api/functions.html

### 1.4 SQL sketch

Schema (names illustrative):

```sql
create table public.availability_rules (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.users(id),
  weekday       smallint not null check (weekday between 1 and 7),  -- ISO: 1=Mon .. 7=Sun
  start_time    time not null,
  end_time      time not null,
  timezone      text not null,                                        -- IANA name, e.g. 'Europe/Berlin'
  starts_on     date not null,                                        -- first local date the rule applies
  until         date,                                                 -- null = "always" (capped by the horizon at expansion time)
  created_at    timestamptz not null default now(),
  check (end_time > start_time),                                      -- v1: no windows crossing local midnight
  check (until is null or until >= starts_on)
);

create table public.availability_exceptions (
  rule_id          uuid not null references public.availability_rules(id) on delete cascade,
  occurrence_date  date not null,                                     -- teacher-local date of the removed occurrence
  primary key (rule_id, occurrence_date)
);
```

Expansion, usable from both PostgREST and the booking RPC:

```sql
create or replace function public.expand_availability(
  p_teacher_id uuid,
  p_from       timestamptz,
  p_to         timestamptz
)
returns table (
  rule_id         uuid,
  occurrence_date date,
  starts_at       timestamptz,
  ends_at         timestamptz
)
language sql
stable
as $$
  with bounds as (
    -- Rolling horizon for open-ended ("always") rules.
    select least(p_to, now() + interval '3 months') as horizon_end
  ),
  rules as (
    select r.*
    from public.availability_rules r
    where r.teacher_id = p_teacher_id
  ),
  days as (
    -- Walk local *dates*; padding one day each side covers zones far from UTC.
    select r.id as rule_id, r.weekday, r.start_time, r.end_time, r.timezone,
           d::date as occurrence_date
    from rules r
    cross join bounds b
    cross join lateral generate_series(
      greatest(r.starts_on, (p_from at time zone r.timezone)::date - 1)::timestamp,
      least(coalesce(r.until, 'infinity'::date), (b.horizon_end at time zone r.timezone)::date + 1)::timestamp,
      interval '1 day'
    ) as d
    where extract(isodow from d) = r.weekday
  )
  select
    x.rule_id,
    x.occurrence_date,
    x.starts_at,
    x.ends_at
  from (
    select
      dd.rule_id,
      dd.occurrence_date,
      (dd.occurrence_date + dd.start_time) at time zone dd.timezone as starts_at,
      (dd.occurrence_date + dd.end_time)   at time zone dd.timezone as ends_at
    from days dd
    where not exists (
      select 1 from public.availability_exceptions e
      where e.rule_id = dd.rule_id and e.occurrence_date = dd.occurrence_date
    )
  ) x
  cross join bounds b
  where x.ends_at > x.starts_at              -- drop windows swallowed by a spring-forward gap
    and x.ends_at   > p_from
    and x.starts_at < b.horizon_end
  order by x.starts_at;
$$;
```

Notes on the sketch:

- `generate_series` runs on `timestamp` (no zone) so the day step is exact; the weekday filter uses `isodow`.
- Converting `p_from`/`p_to` to a local `date` with `at time zone r.timezone` and padding by a day guarantees no occurrence near the boundary is missed; the final `where` trims to the requested instants.
- `'infinity'::date` is valid in Postgres and makes `least()` clean for open-ended rules (the horizon still caps the series).
  Source: https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME-SPECIAL-TABLE
- Because the function is `STABLE` and side-effect free, PostgREST allows `GET /rpc/expand_availability?...` and the React Query hook can filter/order it like a table.

Fit check inside `book_lesson_atomic` (the current function in `supabase/migrations/20260126190606_remote_schema.sql` takes `p_scheduled_at timestamptz` and has no availability check yet; add a `p_duration_minutes` argument or read it from the package's `duration_minutes`):

```sql
  -- inside book_lesson_atomic, after locking the package row
  if not exists (
    select 1
    from public.expand_availability(
           p_teacher_id,
           p_scheduled_at - interval '1 day',
           p_scheduled_at + interval '1 day')
    where starts_at <= p_scheduled_at
      and ends_at   >= p_scheduled_at + make_interval(mins => v_duration_minutes)
  ) then
    raise exception 'Requested time is outside the teacher''s availability';
  end if;
```

Both `starts_at`/`ends_at` and `p_scheduled_at` are instants, so the check is zone-free. The lesson must fit *entirely* inside *one* window; a request spanning two adjacent windows is rejected (merge adjacent windows in the function if you want that to succeed).

Optional hardening for the DST edge cases from §1.2: add a `CHECK` that rejects `start_time`/`end_time` in `01:00–03:59` unless the teacher acknowledged it, or simply surface the hint in the form. This is a product choice; the SQL above is correct either way.

---

## 2. Client approach

### 2.1 date-fns-tz `fromZonedTime`

What it does (source, `src/fromZonedTime/index.ts`): it takes the Date's **local** fields (`getFullYear() … getMilliseconds()`), re-labels them as UTC (`newDateUTC(...)`), then asks `tzParseTimezone(timeZone, new Date(utc))` for the offset and returns `new Date(utc + offsetMilliseconds)`. A string without an offset goes through `toDate(date, { timeZone })` instead. The doc comment: "if the input date represented local time in time zone, the timestamp of the output date will give the equivalent UTC of that local time regardless of the current system time zone."
Source: https://github.com/marnusw/date-fns-tz/blob/master/src/fromZonedTime/index.ts

How it resolves gaps and overlaps (`src/_lib/tzParseTimezone/index.ts`, `fixOffset`): guess UTC with the offset at the naive instant, recompute; if unchanged, done; otherwise shift by the difference and recompute a third time; if the second and third agree, use that; otherwise:

```ts
// If it's different, we're in a hole time. The offset has changed, but we don't adjust the time
return Math.max(o2, o3)
```

Source: https://github.com/marnusw/date-fns-tz/blob/master/src/_lib/tzParseTimezone/index.ts

So for a **nonexistent** time it picks the *larger* offset (summer time), which is the opposite of Postgres's "before" rule. For an **ambiguous** time it lands on whichever offset the two-step guess converges to; in practice the later (standard-time) one, which matches Postgres — but see the host-TZ dependence below. The README documents no gap/overlap policy at all; it only says "An invalid date string or time zone will result in an `Invalid Date`" and, for `getTimezoneOffset`, that "a `Date` should be passed on the second parameter to ensure the offset correctly accounts for DST at that time of year."
Source: https://github.com/marnusw/date-fns-tz/blob/master/README.md

**Verified with `date-fns-tz@3.2.0` under Node 24** (script: build `new Date(y, m, d, h, mi)`, call `fromZonedTime(wall, zone)`, round-trip with `toZonedTime`):

| Zone / input | `TZ=UTC` | `TZ=America/Los_Angeles` | `TZ=Europe/Berlin` | Postgres (§1.2) |
|---|---|---|---|---|
| Berlin 2026-03-29 02:30 (gap) | `00:30Z` | `00:30Z` | input itself became 03:30 (host normalised the Date) → `01:30Z` | `01:30Z` |
| Berlin 2026-10-25 02:30 (overlap) | `01:30Z` | **`00:30Z`** | `01:30Z` | `01:30Z` |
| New York 2026-03-08 02:30 (gap) | `06:30Z` | input itself became 03:30 → `07:30Z` | `06:30Z` | `07:30Z` |
| New York 2026-11-01 01:30 (overlap) | `05:30Z` | `05:30Z` | `05:30Z` | `05:30Z` |
| New York 2026-03-08 09:00 (normal) | `13:00Z` | `13:00Z` | `13:00Z` | `13:00Z` |

Three findings:

1. **Gap: date-fns-tz and Postgres disagree by exactly one hour** (Berlin `00:30Z` vs `01:30Z`; New York `06:30Z` vs `07:30Z`).
2. **Overlap: the date-fns-tz result depends on the host's `TZ`** (Berlin overlap gave `00:30Z` on a Los Angeles host, `01:30Z` elsewhere). This is the mechanism reported in issue #227 ("The DST is being applied to local times … passing a local time into this function is fundamentally wrong and cannot produce unambiguous results", open) and issue #302 ("we took a Date, converted it into the local time zone, then reinterpreted its parts as UTC", open). Note #302 mischaracterises the documented contract — reading local fields *is* the design — but the overlap divergence above is real.
   Sources: https://github.com/marnusw/date-fns-tz/issues/227 , https://github.com/marnusw/date-fns-tz/issues/302 , older: https://github.com/marnusw/date-fns-tz/issues/93
3. **Constructing the wall time as a JS `Date` is itself lossy** whenever the *host* zone has a transition at the same wall time (the "input became 03:30" cells). Any client expander must build wall times as strings or component tuples, never `new Date(y,m,d,h,mi)`.

The reverse direction — `toZonedTime(instant, zone)` and `formatInTimeZone` — starts from an unambiguous instant and is safe for rendering. That is the only direction the client needs if SQL owns expansion.

### 2.2 rrule.js

- The README: "By default, the library operates with 'floating' times or UTC timezones … Returned 'UTC' dates are always meant to be interpreted as dates in your local timezone", and it recommends `new Date(Date.UTC(...))` / the `datetime()` helper. `tzid` "supports use of the `TZID` parameter … using the Intl API", but to get real instants "you may do so (e.g., using Luxon)" — i.e. the library hands back floating wall times and leaves zone conversion to you. `RRuleSet.exdate(dt)` excludes exact datetimes ("Dates included that way will not be generated"); `between(after, before, inc)` is the window query.
  Source: https://github.com/jkbrzt/rrule/blob/master/README.md
- Issue tracker, all about DST and `tzid`: #65 "Day repeats when daylight savings time starts", #157 "Wrong occurrence on day of daylight savings change", #233 "Daily times are wrong around DST when system is not UTC", #294 "DST not applied with tzid" (closed "needs info"), #300 "Daylight Savings change not handled correctly despite 'Timezone Support'" (weekly 13:00 Denver series rendered 12:00 after fall-back; closed without a documented fix), #355 "DTSTART with TZID: between produces incorrect time", #364 "TZID is ignored when converting rrule to string", #550 "Recurrence series changes time of day in time zone after Daylight Savings" (daily 06:00 Denver became 05:00 after 2022-11-06).
  Sources: https://github.com/jkbrzt/rrule/issues/65 , https://github.com/jkbrzt/rrule/issues/157 , https://github.com/jkbrzt/rrule/issues/233 , https://github.com/jkbrzt/rrule/issues/294 , https://github.com/jkbrzt/rrule/issues/300 , https://github.com/jkbrzt/rrule/issues/355 , https://github.com/jkbrzt/rrule/issues/364 , https://github.com/jkbrzt/rrule/issues/550
- Because `exdate` matches exact datetimes, an exception recorded as an instant stops matching if the zone's rules change or if the floating/UTC interpretation differs between the writer and the reader. Our rules are "weekly, one weekday, wall time" — the trivial subset of RFC 5545 — so rrule.js adds an RFC parser and a DST-fragile date model for no benefit.

---

## 3. Where expansion should live, and how exceptions and edits fit

### 3.1 Recommendation: SQL only

- **Single implementation.** `expand_availability` is called by `book_lesson_atomic` for the fit check and by the calendar via `supabase.rpc('expand_availability', …)` / PostgREST GET. The same rows drive both, so rendering and validation cannot disagree. The DST policy is Postgres's documented-in-source rule (§1.2), applied in one place.
- **Client renders instants only.** The hook returns `starts_at`/`ends_at` ISO strings; the UI uses `toZonedTime(iso, viewerTz)` / `formatInTimeZone` for display and `useTimezone()` for the viewer's zone. No `fromZonedTime` on availability data. When the student picks a slot, send the instant (`toISOString()`) to the RPC — the slot came from SQL, so it is already inside a window by construction; the RPC re-checks for race safety (rule edited between render and booking).
- **Editing forms** (teacher enters weekday + `HH:MM` strings + IANA zone) submit wall times as strings; the client never converts them. Optional preview can call `expand_availability` for the next few weeks rather than expanding locally.
- **Why not "both sharing the same rule"?** Sharing a rule is not sharing a resolver: §2.1 shows the two resolvers differ in the gap and one of them varies by host. Duplicating the logic in TypeScript would require re-implementing Postgres's before/after preference and pinning it against host-TZ effects, then keeping two test suites in sync. The cost of the round trip (one indexed query per calendar view) is negligible at this scale.
- **Horizon.** `least(p_to, now() + 3 months)` inside the function enforces the rolling 3-month cap for "always" rules, and the calendar cannot request beyond it.

### 3.2 Exceptions ("this occurrence")

Store `(rule_id, occurrence_date date)` in teacher-local terms. This is stable under tzdata changes and independent of any instant, and it is what the teacher actually means ("not this Tuesday"). The function excludes it with the `not exists` anti-join. If a lesson is already booked inside a removed occurrence, that is a separate product decision (block the removal, or leave the lesson and just stop new bookings); the expansion function does not need to know.

### 3.3 "This and following"

Set `until = occurrence_date - 1` on the existing rule (its exceptions before that date stay valid; those on/after become unreachable and can be garbage-collected or left). If the edit also changes the times, insert a new rule with `starts_on = occurrence_date` and the new `start_time`/`end_time`/`weekday`. Do both in one plpgsql RPC so the split is atomic. Because `until` and `starts_on` are local `date`s, the split boundary is unambiguous even on a DST day.

### 3.4 "All"

`UPDATE availability_rules SET …` in place. Existing exceptions keyed by `occurrence_date` still apply, which is usually the desired semantics ("I still don't work that Tuesday"). If the weekday changes, exceptions on the old weekday will simply never match; drop them in the same statement to keep the table tidy.

### 3.5 Things to decide, not researched further

- Windows crossing local midnight (`end_time < start_time`): excluded by the `CHECK` in the sketch; support later by allowing `end_time` to roll to `occurrence_date + 1`.
- Overlapping rules for one teacher: the sketch returns both; either forbid at write time or `UNION`/merge in the function if lessons should be allowed to span adjacent rules.
- Rule timezone vs `users.timezone`: the sketch stores the zone on the rule so a teacher who moves does not retroactively shift old rules. Decide whether editing the profile zone should rewrite active rules.
