# Research: calendar rendering library vs hand-rolled grid

Resolves [#22](https://github.com/sachinkmohan/teach-direct/issues/22) (part of #21). Researched 2026-09-16 against npm registry metadata, package.json files, official docs, and bundlephobia. Version context: React 19.2, TypeScript 5.9, Vite 6, Tailwind CSS v4, date-fns 4.1 + date-fns-tz 3.2 already installed (`package.json`).

Requirements from the map: week grid (hourly rows, half-hour dashed lines, Sun–Sat), month view, custom event blocks (avatar initial, name, time range, coloured status bar), background shading for availability windows, click on an empty cell to create, rendering in the viewer's stored IANA timezone with an offset label.

## TL;DR recommendation

**Use Schedule-X** (`@schedule-x/calendar` 4.8.0 + `@schedule-x/react` 4.1.0 + `@schedule-x/theme-default`, all MIT).

1. It is the only candidate whose free tier covers every requirement out of the box: week + month views, a first-class `timezone` config (IANA, defaults to UTC), `backgroundEvents` with `rrule`/`exdate` (fits availability windows), per-view custom React event components, and `onClickDateTime` for click-to-create.
2. It is the smallest (37 KB gzip vs 44 KB FullCalendar core alone, 53 KB react-big-calendar) and the most recently released (4.8.0 on 2026-09-08).
3. The paid features (drag-to-create, event modal, sidebar, resource view, Gantt) are not on our map. If drag-to-create becomes wanted later it is €479/year, comparable to FullCalendar Premium.

Runner-up: **FullCalendar v7** (MIT core, React 17–19). Also meets every requirement for free, but v7 shipped this month with a Temporal-based API (`temporal-polyfill` peer dependency) and its docs steer named-zone date handling toward Temporal `ZonedDateTime`; that is a larger conceptual surface than we need and the v7 docs are still settling. Pick it only if Schedule-X's Preact-under-React layering causes trouble in the prototype.

Do **not** hand-roll: the week grid alone (overlapping events, half-hour lanes, DST-day column heights, month overflow) is a multi-week effort with no product upside, and none of the three libraries fights Tailwind v4 (they ship plain CSS files you import once).

Do **not** use react-big-calendar: timezone display depends on a localizer's global default (moment-timezone `setDefault`), and it pulls moment, moment-timezone, luxon, dayjs, globalize and lodash as hard dependencies.

## Comparison

| | Schedule-X | FullCalendar v7 | react-big-calendar | Hand-rolled |
|---|---|---|---|---|
| Version / released | calendar 4.8.0, 2026-09-08; react adapter 4.1.0, 2026-01-21 | 7.1.0, 2026-09-05 (v6.1.21 plugins last 2026-06-18) | 1.20.0, 2026-06-01 | n/a |
| Licence | MIT; premium plugins €479/yr or €999 lifetime | MIT; Premium from $480/yr | MIT | n/a |
| React 19 | `react: ^16.7 \|\| ^17 \|\| ^18 \|\| ^19` | `react: ^17 \|\| ^18 \|\| ^19` | `react: ^16.14 \|\| ^17 \|\| ^18 \|\| ^19` | yes |
| Peer deps beyond React | `preact`, `@preact/signals`, `temporal-polyfill@0.3.0` | `temporal-polyfill ^1.0.1` | none | none |
| Week + month views | free (month grid, week, day, month agenda) | free (timegrid, daygrid) | free | build both |
| Viewer IANA timezone | `timezone` config, free | `timeZone` option, named zones without extra plugin; API `Date`s only honour local/UTC, use Temporal for true zoned values | via moment-timezone global default (or luxon/dayjs localizer), affects all dates | date-fns-tz, already installed |
| Custom event block | `customComponents.timeGridEvent` / `monthGridEvent` React components | `eventContent` returns JSX | `components.event` | trivial |
| Availability shading | `backgroundEvents` with `style`, `rrule`, `exdate`, free | `display: 'background'` events, per-event colour/class, not draggable | `slotPropGetter` / `dayPropGetter` styling hooks | trivial |
| Click empty cell | `onClickDateTime` (Temporal.ZonedDateTime), `onClickDate` | `dateClick` (interaction plugin) | `onSelectSlot` | trivial |
| Gzip size (bundlephobia) | 37.3 KB (calendar 4.8.0) | 44.2 KB (core 6.1.21; plugins extra) | 53.3 KB (1.20.0, excluding date libs) | 0 |
| Tailwind v4 | ships theme CSS; import once | ships CSS; import once | ships CSS; import once | native |

## Per-option notes

### Schedule-X

- Views: month grid, week, day, month agenda. Source: https://schedule-x.dev/docs/calendar
- Configuration: `timezone` ("Set the timezone. Defaults to 'UTC'", e.g. `'Asia/Tokyo'`), `firstDayOfWeek` (Temporal numbering, 1 = Monday, 7 = Sunday; the reference screenshot starts on Sunday so set 7), `weekOptions.gridHeight`, `weekOptions.nDays`, `weekOptions.timeAxisFormatOptions`, callbacks `onClickDate`, `onClickDateTime` (receives `Temporal.ZonedDateTime`), `onEventClick`. Source: https://schedule-x.dev/docs/calendar/configuration
- Events: `id`, `start`, `end` as `Temporal.PlainDate` or `Temporal.ZonedDateTime`, optional `title`, `people`, `calendarId`, arbitrary extra fields returned on interaction. Source: https://schedule-x.dev/docs/calendar/events
- Background events: `backgroundEvents: [{ start, end, style, title?, rrule?, exdate? }]`, documented as free and "meant to be used for displaying things such as out-of-office hours". Source: https://schedule-x.dev/docs/calendar/advanced/background-events
- React: `customComponents` slots `timeGridEvent`, `dateGridEvent`, `monthGridEvent`, `monthAgendaEvent`, `weekAgendaEvent`, each receiving `calendarEvent`. Source: https://schedule-x.dev/docs/frameworks/react
- Premium (⭐ in docs, https://schedule-x.dev/premium): drag and drop, resize, interactive event modal, sidebar, drag-to-create, draw, scheduling assistant, resource scheduler, Gantt, time-grid resource view. None are on the map.
- Peer deps from npm: `@preact/signals ^2.0.2`, `preact ^10.19.2`, `temporal-polyfill 0.3.0` (pinned). The React adapter wraps a Preact core, so React and Preact both ship. Adapter 4.1.0 declares `@schedule-x/calendar ^3.1.0 || ^4.0.0`, so it pairs with calendar 4.8.0.
- Maintenance: CHANGELOG shows 4.8.0 (2026-09-08), 4.7.0 (2026-08-27), 4.6.1 (2026-07-08). Source: https://github.com/schedule-x/schedule-x/blob/main/CHANGELOG.md
- Caveat: the `timezone` doc page and DST semantics were not reachable at a stable URL during research; the prototype must verify that a `ZonedDateTime` event renders at the right wall time across the 2026-10-25 Berlin fall-back.

### FullCalendar v7

- npm: `fullcalendar` 7.1.0 and `@fullcalendar/react` 7.1.0 published 2026-09-05, MIT, peer `temporal-polyfill ^1.0.1`; `fullcalendar` depends on `@fullcalendar/core`, `@full-ui/headless-calendar`, and `preact`. The v6 plugin packages (`@fullcalendar/timegrid` etc.) remain at 6.1.21.
- React connector: peer `react ^17 || ^18 || ^19`; `eventContent` may return JSX. Source: https://fullcalendar.io/docs/react
- Pricing: everything not marked Premium is MIT; Premium (Timeline, vertical Resource view, printer-friendly rendering) from $480/yr with developer seats. Source: https://fullcalendar.io/pricing
- Timezone: named IANA zones work without a plugin; "The resulting date objects from the API only effectively support local and UTC time zones. If you'd like a date object that truly reflects the calendar's time zone, you'll need to use Temporal." Source: https://fullcalendar.io/docs/timeZone
- Background events: `display: 'background'`, per-event `color` and class names, "not editable". Source: https://fullcalendar.io/docs/background-events
- Week view: `timeGridPlugin` (`slotDuration`, `slotHeaderInterval`, `nowIndicator`, `allDaySlot`), imported as `fullcalendar/timegrid` in v7. Source: https://fullcalendar.io/docs/timegrid-view
- Size: `@fullcalendar/core` 6.1.21 is 156.5 KB / 44.2 KB gzip before plugins (bundlephobia). v7 numbers were not on bundlephobia at research time.

### react-big-calendar

- npm: 1.20.0, 2026-06-01, MIT, peer `react ^16.14 || ^17 || ^18 || ^19`. Hard dependencies include `moment`, `moment-timezone`, `luxon`, `dayjs`, `globalize`, `lodash`, `lodash-es`, `prop-types`, `react-overlays`. Source: https://github.com/jquense/react-big-calendar/blob/master/package.json
- Timezones guide: "Javascript Date objects don't really support time zone switching natively… if you use moment-timezone you can get your events to display relevant to a time zone other than the browser native" via `moment.tz.setDefault(zone)`, which "affects all dates, created by moment, from that point forward"; luxon and dayjs localizers "operate in a similar fashion". Source: https://github.com/jquense/react-big-calendar/blob/master/stories/guides/Timezones.mdx
- Size: 187 KB / 53.3 KB gzip (bundlephobia, 1.20.0), before the date library it needs.

### Hand-rolled Tailwind grid

- Zero dependencies and perfect visual control, and date-fns-tz is already installed for rendering instants in the viewer's zone.
- Cost: week grid layout with overlapping events, half-hour lanes, now-indicator, DST days with 23 or 25 hours, month grid with overflow chips, keyboard access, and responsive behaviour. All of this is exactly what the libraries above already do, and none of it differentiates the product.

## Trade-offs to carry into the prototype ticket

1. **Temporal everywhere.** Both Schedule-X and FullCalendar v7 now expect `Temporal.ZonedDateTime` for timed events and return Temporal values from callbacks. The app's data layer uses ISO strings and date-fns. The prototype should include a tiny adapter (`Temporal.Instant.from(iso).toZonedDateTimeISO(viewerTz)`) and confirm `temporal-polyfill` version conflicts do not arise (Schedule-X pins 0.3.0, FullCalendar wants ^1.0.1, so they cannot coexist; pick one library).
2. **Two renderers in the bundle.** Schedule-X and FullCalendar v7 both bundle Preact under the React adapter. Roughly 10 KB gzip, acceptable.
3. **Availability windows as background events.** Since the recurrence research decided expansion happens in SQL, feed Schedule-X plain expanded `start`/`end` background events for the visible range and do not use its `rrule` field. That keeps the fit check and the rendering on the same rows.
4. **Sunday-first week** and 24-hour time axis: configure `firstDayOfWeek: 7` and `timeAxisFormatOptions: { hour: '2-digit', minute: '2-digit', hour12: false }`.
5. **Verify DST rendering** for the viewer's zone in the prototype (Berlin 2026-03-29 and 2026-10-25).
