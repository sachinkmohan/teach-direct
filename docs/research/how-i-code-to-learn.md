# How I code to learn

Written 2026-09-16. A personal guide for writing code on the calendar feature in a way that grows my skills without wasting hours on typing. Companion to `how-i-am-building-the-calendar.md`, which covers the overall approach. This file is only about the act of coding.

## The one idea

Typing is not where the learning is. The learning is in three places: deciding what should exist, reading what got written, and explaining why it is that way. So I spend my time on those three and let tools do the typing wherever the typing teaches me nothing.

## Two kinds of code in this feature

**Growth code.** The parts that match my growth targets, data modelling and system design. I type these myself, slowly, and I ask for help only through the escalation ladder below.

- The availability tables and their constraints.
- The `expand_availability()` SQL function.
- The fit, overlap, and notice checks inside `book_lesson_atomic`.
- The React Query hooks: query keys, what they fetch, what they invalidate.
- The lesson request state changes.

**Plumbing code.** The parts that are repetitive or already have an example in the repo. I use skeleton-first for these, see below.

- Components and their Tailwind classes.
- Form wiring with React Hook Form and Zod.
- Modal open and close state.
- Mapping database rows into the shape a library wants.

If I am unsure which kind a piece is, I ask: "would a senior engineer be judged on how this piece is designed?" If yes, it is growth code.

## Skeleton-first, for plumbing code

1. I write the skeleton: file name, exported function names and their signatures, props types, and a one-line comment above each step saying what it does. No bodies. This is the thinking. It takes minutes.
2. Claude fills the bodies from the skeleton. In this repo I use Claude rather than Copilot for this because Claude can see the research files, the map, and the existing hooks at the same time.
3. I read every line before keeping it. Anything I cannot explain, I delete or ask about. Reading is not skimming: I say what each line does in my head.
4. If I disagree with how a body was written, I say so and have it redone my way. That disagreement is the senior moment, not the typing.

A skeleton for a hook looks like this, and nothing more:

```ts
// Fetch the teacher's expanded availability windows for the visible date range.
// Calls the expand_availability RPC. Cached 5 minutes. Keyed by teacher and range.
export function useAvailabilityWindows(teacherId: string, from: Date, to: Date) {
  // useQuery: key ['availability', teacherId, from, to]
  // queryFn: supabase.rpc('expand_availability', {...})
}
```

## Attempt-first, for growth code

1. Before writing, I read the research file that covers the piece and sketch the three boxes: table or function, hook, component, and what flows between them.
2. I write the code myself.
3. When stuck, I climb the ladder, one rung at a time, trying each before asking for the next:
   - a hint about where to look or which concept applies
   - pseudo-code for the step I am on
   - the single line I am missing
   - the whole function, explained
4. Forty-five minutes on one stuck point is the limit. After that Claude writes that one piece and explains it, and I write the next similar piece myself. Nobody takes over a whole file.

## Using GitHub Copilot, if I turn it on

- Good for: syntax I already know but type slowly. Tailwind class lists, import lines, JSX boilerplate, a `useState` pair.
- Bad for: anything I am trying to learn. It completes whole logic before I have thought about it, and it cannot see the research files or the map.
- Rule: Copilot off while writing growth code. Copilot on, if at all, only for plumbing code, and never in the same file where Claude is filling a skeleton.
- Test for myself: if I accept a suggestion I could not have written, I stop and read it until I could have.

## Habits that make the code teach me

- **Name things before writing them.** A function whose name I cannot decide is a function I do not understand yet.
- **Write the comment, then the code.** One line saying what the block does. If the comment is hard to write, the design is unclear.
- **Read the existing example first.** Every new hook has a sibling in `src/hooks/`. Every new modal has `BookingModal.tsx`. Every new RPC has `book_lesson_atomic`. I read the sibling before writing the new one.
- **Run it before asking.** A local `supabase db reset` and `npm run dev` answers most questions faster than a chat.
- **Predict before running.** Before I run something, I say what I expect to happen. When it differs, that gap is the lesson.
- **One thing at a time.** One function, one commit. If a change touches SQL and a hook and a component, I do them as three commits in that order.
- **Explain the diff out loud** before the pull request, as if to a colleague. If I stumble, I go back and read that part again.

## What "faster" actually means

Faster is not fewer minutes typing. Faster is fewer times rewriting because I did not understand. Skeleton-first and attempt-first both spend time up front on thinking so that the code is right the first time. A day spent on the availability table design saves a week of migrations later.

## Check-in questions, end of each iteration

1. Which piece did I type myself, and could I write it again from memory tomorrow?
2. Which generated line did I delete or change, and why?
3. Where did I climb the ladder, and which rung actually unblocked me?
4. What would I name differently now?
5. Did anything get built that I still cannot explain? If yes, that is the first task next session.
