# Research: iCal feed format and Apple/Google subscription behaviour

Resolves GitHub issue #23 (part of #21). Date: 2026-09-16.

Goal: serve a per-user, secret-URL `.ics` feed of booked lessons (one-off events, no recurrence) from a Supabase Edge Function that students and teachers can subscribe to in Apple Calendar and Google Calendar, and that can be regenerated if leaked.

Sources are primary only (RFCs, Apple/Google/Supabase docs, library repos and registries). Where a vendor does not document a behaviour, that is stated explicitly rather than filled in from blog posts.

## 1. Summary of constraints

### 1.1 ICS structure (RFC 5545 / RFC 7986)

| Requirement | What the spec says | Source |
|---|---|---|
| Calendar envelope | `BEGIN:VCALENDAR` ... `END:VCALENDAR`; `PRODID` and `VERSION:2.0` are required calendar properties. | [RFC 5545 §3.6, §3.7.3, §3.7.4](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.7) |
| `METHOD` | Optional. When absent the object is plain calendar data, not an iTIP scheduling message. For a subscription feed omit it (or use `PUBLISH`); never `REQUEST`/`CANCEL`, which are iTIP invitations. | [RFC 5545 §3.7.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.7.2) |
| Required VEVENT properties | `UID`, `DTSTAMP`, `DTSTART` are REQUIRED (`DTSTART` is required when `METHOD` is absent). Everything else (`DTEND`, `SUMMARY`, `DESCRIPTION`, `STATUS`, `SEQUENCE`, `URL`, `LOCATION`) is optional. | [RFC 5545 §3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1) |
| `UID` stability | "MUST be globally unique and persistent". The client uses it to match an event across polls, so the UID must not change between fetches. Recommended: `lesson-<lessons.id>@learnfromatutor.com`. | [RFC 5545 §3.8.4.7](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.4.7) |
| `DTSTAMP` | Required. Represents when the iCalendar object was created; in a feed it is regenerated on each response (use `now`, or `lessons.updated_at` if you want byte-stable output). | [RFC 5545 §3.8.7.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.7.2) |
| `SEQUENCE` | "Revision sequence number of the calendar component". Increment it when the lesson is rescheduled or cancelled so clients treat the new copy as newer. Default is 0. | [RFC 5545 §3.8.7.4](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.7.4) |
| Cancellations | `STATUS:CANCELLED` on the VEVENT "indicates the event was cancelled". Keep the cancelled event in the feed (same UID, bumped SEQUENCE) for a grace window; if you just drop it, clients remove it on next poll anyway. | [RFC 5545 §3.8.1.11](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.1.11) |
| UTC date-times | Use the UTC form `YYYYMMDDTHHMMSSZ` (the `Z` suffix). `lessons.scheduled_at` is `timestamptz`, so emit it in UTC and let the client render in the user's zone. No `VTIMEZONE` needed. | [RFC 5545 §3.3.5](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.5) |
| Line endings and folding | Content lines are delimited by CRLF; lines SHOULD NOT exceed 75 octets and are folded with CRLF + one whitespace. | [RFC 5545 §3.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.1) |
| Text escaping | In TEXT values `;`, `,`, `\` MUST be escaped with backslash; newline as `\n`. Applies to `SUMMARY`, `DESCRIPTION`, `LOCATION`. | [RFC 5545 §3.3.11](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.11) |
| Calendar name | `NAME` (RFC 7986 §5.1) is the standard property. `X-WR-CALNAME` is the non-standard vendor property Apple/Google actually read; ical-generator emits both. Emit both. | [RFC 7986 §5.1](https://www.rfc-editor.org/rfc/rfc7986.html#section-5.1) |
| Refresh hint | `REFRESH-INTERVAL;VALUE=DURATION:PT1H` is "a suggested minimum interval for polling"; clients "SHOULD" respect it as a minimum. `X-PUBLISHED-TTL` is the legacy non-standard equivalent, not mentioned in RFC 7986. Emit both. Note this is a hint, and Google ignores it in practice (see 1.3). | [RFC 7986 §5.7](https://www.rfc-editor.org/rfc/rfc7986.html#section-5.7) |
| Media type / charset | Media type is `text/calendar`; default charset is UTF-8 and "the charset Content-Type parameter MUST be used in MIME transports". So: `Content-Type: text/calendar; charset=utf-8`. | [RFC 5545 §8.1, §3.1.4](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.1.4) |

### 1.2 Apple Calendar

- Subscribe by URL: `File > New Calendar Subscription`, enter the web address, then choose a Location (iCloud makes it available on all devices; On My Mac keeps it local). [Apple Calendar User Guide: Subscribe to calendars](https://support.apple.com/guide/calendar/icl1022/10.0/mac/10.13) (older guide revision has the full text; the current page `subscribe-to-calendars-icl1022/mac` renders the same steps client-side).
- Refresh: "Subscribed calendars can be refreshed automatically ... Control-click the calendar's name, then choose Get Info. Click the 'Auto-refresh' pop-up menu, then choose an option." Apple's doc does not enumerate the options; the shipping UI offers Every 5 minutes / 15 minutes / hour / day / week. [Apple: Refresh calendars on Mac](https://support.apple.com/guide/calendar/refresh-calendars-icl1024/mac)
- iPhone/iPad/Mac subscriptions through iCloud: [Apple: Use iCloud calendar subscriptions](https://support.apple.com/en-us/102301). The doc gives no refresh interval; iCloud-hosted subscriptions are fetched by Apple's servers, not the device (so the feed URL must be reachable from the public internet).
- The `webcal://` scheme is the conventional way to make a link open the subscribe dialog; it is not defined in any RFC and Apple's guide does not mention it. Offer an `https://` URL and a `webcal://` variant of the same URL.

### 1.3 Google Calendar

- Subscribe by URL: "Add other calendars > From URL", paste the address. [Google: Subscribe to someone's Google Calendar (Use a link to add a public calendar)](https://support.google.com/calendar/answer/37100?hl=en)
- Refresh latency (the primary statement): the same help page carried the tip "It might take up to 12 hours for changes to show in your Google Calendar." It is in the [2021 archived copy](https://web.archive.org/web/2021id_/https://support.google.com/calendar/answer/37100?hl=en) and is quoted verbatim, with a link to that page, in the Google Calendar Community thread ["Google Calendar does not sync URL-linked calendars within 12 hours as stated"](https://support.google.com/calendar/thread/12658899?hl=en). The current (2026) revision of the page no longer includes the sentence. There is no user or publisher setting to speed this up; `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` are not honoured.
- Google fetches the URL from its servers (the feed must be publicly reachable over HTTPS with a valid certificate). There is no documented size or event-count limit for URL subscriptions; the Calendar API quota page lists only request quotas. [Google Calendar API usage limits](https://developers.google.com/workspace/calendar/api/guides/quota)
- Practical implication for the product: tell users that Google may take up to a day to reflect a new booking or cancellation; Apple can be set to 5 minutes.

### 1.4 Auth: token must be in the URL

- Neither Apple nor Google lets a subscriber attach custom headers to a subscription fetch; the only input is the URL (Apple does support HTTP Basic credentials in the subscription dialog, but Google does not, and Basic auth is a poor UX for a share link). Therefore the secret must be a path or query component: `https://<project>.supabase.co/functions/v1/calendar-feed/<token>.ics`.
- Treat the token like a password: >= 128 bits of randomness (`crypto.getRandomValues`, base64url), store only a hash (e.g. SHA-256) in the DB, look up by hash, and allow regeneration (delete old row, insert new) so a leaked URL can be revoked. Since the feed is read-only and contains only the user's own lessons, the blast radius of a leak is disclosure, not mutation.
- Serve `Cache-Control: private, max-age=300` (or `no-store`) so intermediate caches never share the body.

### 1.5 Supabase Edge Functions without a JWT

- Default: functions "reject requests without a valid JWT in the Authorization header". Disable per function in `supabase/config.toml` with `[functions.calendar-feed] verify_jwt = false`, or pass `--no-verify-jwt` to `supabase functions deploy` / `serve` ("Disable JWT verification for the Function."). The flag overrides config. [Supabase CLI config reference](https://supabase.com/docs/guides/local-development/cli/config) and [supabase functions deploy](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
- With verification off, "anonymous callers can reach the handler" and "your handler is fully responsible for authenticating the caller"; the docs warn never to expose sensitive data this way "without verifying the caller some other way" (the token lookup is that verification). [Supabase: Edge Function auth](https://supabase.com/docs/guides/functions/auth)
- This repo already uses `verify_jwt = false` for all six functions in `supabase/config.toml`, and `stripe-webhook` is called by Stripe with no `apikey` header, which demonstrates the gateway does not require the anon key once JWT verification is disabled. (Supabase's quickstart curl examples still pass `apikey`; the docs do not state it is optional, so this is verified by the working webhook rather than by documentation.)
- Function URL shape: `https://<project>.supabase.co/functions/v1/<name>`; read the token with `new URL(req.url).pathname.split('/').pop()`. [Supabase: Routing](https://supabase.com/docs/guides/functions/routing)
- Limits: 256 MB memory, 2 s CPU time per request, 150 s wall clock (free) / 400 s (paid), 150 s idle timeout. A feed of a few hundred events is a few hundred KB of text and well inside these. [Supabase: Edge Function limits](https://supabase.com/docs/guides/functions/limits)

### 1.6 Deno-compatible ICS libraries

| Library | Licence | Latest | Maintenance | Deno | Feed features | Verdict |
|---|---|---|---|---|---|---|
| [ical-generator](https://github.com/sebbo2002/ical-generator) (sebbo2002) | MIT | 11.1.1, 2026-08-25 | Active, frequent releases; ~2.2k commits | Yes: published on JSR as [`@sebbo2002/ical-generator`](https://jsr.io/@sebbo2002/ical-generator) with a Deno-compatible badge; `deno add jsr:@sebbo2002/ical-generator` | `name()` emits `NAME` + `X-WR-CALNAME`; `ttl(seconds)` emits `REFRESH-INTERVAL;VALUE=DURATION` + `X-PUBLISHED-TTL`; per-event `status(CANCELLED)`, `sequence(n)`, `url`, `location`, `description`; native `Date` input; `method()` optional. Date libs (dayjs/luxon/moment) are optional peer deps. Handles folding and escaping. | Recommended |
| [ics](https://github.com/adamgibbons/ics) (adamgibbons) | ISC | 3.12.0, 2026-04-23 | Maintained (last commit 2026-05-19) | Not published for Deno; npm CJS/ESM via `npm:ics` specifier would work but is untested | Supports `status`, `sequence`, `calName`, `method` (now optional), emits `X-PUBLISHED-TTL`; dates as `[y,m,d,h,m]` arrays or epoch ms; no `REFRESH-INTERVAL`; pulls `yup`, `nanoid`, `runes2` | Usable, less ergonomic |
| Hand-rolled template | n/a | n/a | n/a | n/a | ~40 lines: CRLF join, 75-octet folding, TEXT escaping, UTC formatting. No dependency, but folding and escaping are easy to get subtly wrong. | Fallback if a dependency is unwanted |

## 2. Minimal example ICS body

Lines end with CRLF. Two events: one scheduled, one cancelled (same UID as when it was scheduled, SEQUENCE bumped).

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Learn From A Tutor//Lesson Feed//EN
CALSCALE:GREGORIAN
NAME:Learn From A Tutor Lessons
X-WR-CALNAME:Learn From A Tutor Lessons
REFRESH-INTERVAL;VALUE=DURATION:PT1H
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:lesson-4f1c2b6e-9d2a-4e0b-8c4d-2b7a1f3e9c10@learnfromatutor.com
DTSTAMP:20260916T090000Z
DTSTART:20260918T140000Z
DTEND:20260918T150000Z
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:German lesson with Anna Schmidt
DESCRIPTION:60 min lesson.\nJoin: https://meet.example.com/abc-defg-hij
URL:https://app.learnfromatutor.com/lessons/4f1c2b6e-9d2a-4e0b-8c4d-2b7a1f3e9c10
END:VEVENT
BEGIN:VEVENT
UID:lesson-0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d@learnfromatutor.com
DTSTAMP:20260916T090000Z
DTSTART:20260920T100000Z
DTEND:20260920T103000Z
SEQUENCE:1
STATUS:CANCELLED
SUMMARY:CANCELLED: Spanish lesson with Luis Ortega
END:VEVENT
END:VCALENDAR
```

Notes:
- `DTEND = DTSTART + lessons.duration_minutes`.
- Map lesson status: `scheduled`, `completed`, `pending_confirmation`, `confirmed` -> `STATUS:CONFIRMED`; `cancelled` -> `STATUS:CANCELLED`; `disputed` -> `CONFIRMED` (it happened). Prefix the summary with "CANCELLED:" because some clients hide `STATUS` visually.
- `SEQUENCE` needs a persisted counter; simplest is a new `lessons.ical_sequence int default 0` bumped by the reschedule/cancel RPCs, or derive it as `0` for scheduled and `1` for cancelled if rescheduling is not supported.

## 3. Recommended Edge Function shape

New function `supabase/functions/calendar-feed/index.ts`, following the existing style (`serve` from deno std, service-role client, early returns).

Schema addition (migration):

```sql
create table public.calendar_feed_tokens (
  user_id    uuid primary key references public.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
-- RLS: users may select/insert/delete their own row; the Edge Function uses the service role.
```

Client side: generate 32 random bytes with `crypto.getRandomValues`, base64url-encode, store SHA-256 hex of it via a small RPC, and show the user `https://<project>.supabase.co/functions/v1/calendar-feed/<token>.ics` plus a `webcal://` variant. "Regenerate" deletes and re-inserts the row; the old URL then 404s.

Function sketch:

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import ical, { ICalEventStatus } from "npm:ical-generator@11"; // or jsr:@sebbo2002/ical-generator

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  // /functions/v1/calendar-feed/<token>.ics
  const token = new URL(req.url).pathname.split("/").pop()?.replace(/\.ics$/, "") ?? "";
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return new Response("Not found", { status: 404 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await admin.from("calendar_feed_tokens")
    .select("user_id").eq("token_hash", await sha256Hex(token)).maybeSingle();
  if (!row) return new Response("Not found", { status: 404 }); // same response as malformed: no token oracle

  const { data: lessons, error } = await admin.from("lessons")
    .select("id, scheduled_at, duration_minutes, status, meeting_link, updated_at, teacher:teacher_id(full_name), student:student_id(full_name)")
    .or(`student_id.eq.${row.user_id},teacher_id.eq.${row.user_id}`)
    .gte("scheduled_at", new Date(Date.now() - 90 * 86400_000).toISOString()) // bound the feed size
    .order("scheduled_at");
  if (error) return new Response("Error", { status: 500 });

  const cal = ical({ name: "Learn From A Tutor Lessons", prodId: { company: "Learn From A Tutor", product: "Lesson Feed" }, ttl: 3600 });
  for (const l of lessons ?? []) {
    const start = new Date(l.scheduled_at);
    const cancelled = l.status === "cancelled";
    cal.createEvent({
      id: `lesson-${l.id}@learnfromatutor.com`,          // UID: stable
      stamp: new Date(l.updated_at),                       // DTSTAMP
      sequence: cancelled ? 1 : 0,                         // or lessons.ical_sequence
      start,
      end: new Date(start.getTime() + l.duration_minutes * 60_000),
      status: cancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
      summary: `${cancelled ? "CANCELLED: " : ""}Lesson with ${/* counterpart name */ ""}`,
      description: l.meeting_link ? `Join: ${l.meeting_link}` : undefined,
      url: `${Deno.env.get("APP_URL")}/lessons/${l.id}`,
    });
  }

  return new Response(cal.toString(), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="lessons.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
});
```

`supabase/config.toml`:

```toml
[functions.calendar-feed]
verify_jwt = false
```

Rationale for choices:
- 404 for both bad-format and unknown tokens, and no CORS headers (calendar clients are not browsers; a browser hitting it directly is fine because it is same-origin-irrelevant GET).
- No `METHOD` line: it is a feed, not an invitation.
- `Cache-Control: private` so a CDN never serves one user's feed to another.
- Bounding to the last 90 days plus all future lessons keeps the body small; Google/Apple have no documented limit but re-download the whole file on every poll.

## 4. Open questions

1. Whether Supabase's API gateway ever requires `apikey` on a `verify_jwt = false` function is not stated in the docs; the working `stripe-webhook` says no. Confirm with a `curl` against the deployed function with no headers before shipping.
2. Google's "up to 12 hours" tip has been removed from the current help page; observed behaviour in the community thread is 12 to 24+ hours. Product copy should say "may take up to a day" for Google.
3. Apple's Auto-refresh interval list (5 min to 1 week) is not in Apple's documentation, only in the UI. Worth a screenshot in user-facing help rather than a doc citation.
4. Should cancelled lessons stay in the feed forever, or age out (e.g. 30 days after `scheduled_at`)? Dropping them is safe because clients remove events missing from a re-fetched feed, but keeping `STATUS:CANCELLED` for a while gives users a visible trace.
5. Per-user timezone: emitting UTC (`Z`) is correct and simplest; if a user's `users.timezone` differs from their device timezone the client still renders in the device's zone, which is the expected behaviour for calendars.
6. Rescheduling: if lessons can be moved, `SEQUENCE` must increment on each move (needs a persisted column or a derivation from an audit trail). If not supported yet, the scheduled=0 / cancelled=1 mapping is enough.
7. `jsr:` vs `npm:` specifier for ical-generator in the Supabase runtime: both are supported by Supabase's Deno runtime in principle; pick one and verify with `supabase functions serve`.
8. Rate limiting: Google and Apple poll modestly, but a leaked URL could be hammered. Consider Supabase's built-in rate limiting or a cheap per-token counter if this becomes a problem.
