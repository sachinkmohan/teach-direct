# How I am building the calendar feature

Written 2026-09-16. This is my own note on the way I chose to build the calendar feature, why I chose it, and how I pick up work each time I come back. Read this first when resuming.

## The decision in one paragraph

The calendar feature is large: teacher availability with recurrence, a booking guard in the database, two calendar views, a lesson request flow, and an iCal feed. Instead of building it in one go, I build it in nine small iterations, each shippable on its own, and I make each remaining design decision one at a time, in a session of its own, writing the reasoning down myself. Claude explains before anything is written, I write all the code myself, and Claude unblocks me in the smallest possible step when I am stuck. Before any change merges, I answer five questions about it to prove I understood it.

## Why I chose this

<!-- In my own words. Fill this in. Prompts: what felt overwhelming, what I want to be able to do in a year, why speed was the problem and not the help. -->

What I told Claude when this was decided, for the record:

- The requirement felt huge and intimidating for an intermediate developer.
- When things are built fast and decisions are made fast, I cannot review the changes or understand the concepts.
- I want to become a senior engineer by understanding how things are designed, developed, and architected, not by watching them appear.
- I want to use good software practices while doing it, and I want to be able to question why things are built a certain way.

## The three documents and what each one is for

| Document | Answers | Where |
|---|---|---|
| Wayfinder map | *What* to build. The destination, decisions already made, seven decisions still open, and what is out of scope. | GitHub issue [#21](https://github.com/sachinkmohan/teach-direct/issues/21) |
| Iterative build plan | *In what order* to build. Nine iterations, smallest and safest first, each naming the concept it teaches and the map decision it waits on. | `docs/research/iterative-build-plan.md` |
| Learning mode | *How* Claude and I work together in every session. | The "Learning mode" section at the end of `CLAUDE.md` |

The map is not a document to follow at speed. It is a queue of questions I answer at my own pace. The plan tells me which question comes next. Learning mode stops any session from running ahead of me.

Supporting reading, already done and merged into the repo:

- `docs/research/recurrence-expansion.md`: why availability is expanded in SQL, not in the browser.
- `docs/research/ical-feed.md`: how the calendar feed must be shaped and served.
- `docs/research/calendar-rendering-library.md`: why Schedule-X was chosen to render the calendar.

## My learning preferences

- **Growth targets:** data modelling and system design. Every iteration should exercise one of these.
- **Understand first, then pair.** I read and get things explained before building. Once a concept is clear, I pair.
- **I write the code, all of it, including SQL.** Before writing I sketch what needs to exist (table or function, hook, component, what flows between them) and Claude reviews the sketch. When I am stuck, Claude unblocks me in the smallest step that works: a hint, then pseudo-code, then the single line, then the whole function, each only after I tried the previous one. After about 45 minutes stuck on one point, Claude writes that one piece and explains it, and I write the next similar piece myself. Claude never takes over a whole file.
- **One decision per session.** Claude lays out options and trade-offs. I choose.
- **I author the ADRs.** For a decision that is hard to reverse, surprising later, and a real trade-off, I write the Architecture Decision Record in `docs/adr/` in my own words. Claude checks it for accuracy only.
- **Teach-back before merge.** Five questions per pull request: three recall, one prediction ("what breaks if X changes"), one redesign ("how would you change this if Y").
- **Learning log.** One entry per iteration in `docs/research/learning-log.md`: what was built, the five-question results, and "what did I not understand this time".
- **Practices I keep.** One migration file per schema change. One pull request per iteration from a branch off `main`, with a description that says why. Test tooling arrives at iteration 4, not before.
- **Pace.** Time is not the constraint. Clarity is. No fixed deadline per iteration.

## How I resume a session

1. **Commit or stash nothing by accident.** Run `git status` and make sure the previous session's work is committed on its branch.
2. **Open a new Claude Code session** in the repo. It reads `CLAUDE.md`, so Learning mode is already on. I do not need to re-explain my preferences.
3. **Read before deciding.** If the next step is a decision, first ask Claude to explain the concept behind it, using the research file that covers it. No code, no decision yet.
4. **Make the one decision.** Run `/wayfinder https://github.com/sachinkmohan/teach-direct/issues/21`. It picks the next unblocked ticket. Claude lays out the options, I choose, I write the ADR if it qualifies.
5. **Build the iteration.** Open `docs/research/iterative-build-plan.md`, find the current iteration, confirm its map decision is made, and ask Claude to explain the three-box slice (table or SQL function, hook, component) before any code. Then build the smallest diff on a new branch off `main`.
6. **Prove it.** Teach-back with five questions. Write the learning log entry. Open the pull request.
7. **Stop when the iteration ships.** The next session starts at step 1.

## Where things stand today

- Setup, research, build plan, and Learning mode are on branch `LFT-24`.
- Next decision on the map: the availability data model, GitHub issue [#26](https://github.com/sachinkmohan/teach-direct/issues/26). Iteration 1 needs only this one.
- First reading task: `docs/research/recurrence-expansion.md`. The check for myself: can I explain why an availability rule stores a plain time plus a timezone name rather than a timestamp?
- No code for the feature has been written yet. That is intentional.
