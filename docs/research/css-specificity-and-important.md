# Why `!important` was the wrong first move

Branch: `LFT-24`. Date: 2026-09-27.

While fixing a clipped time label on the calendar, a one-line CSS rule silently did
nothing, and the fix was to make the selector *longer* rather than to add
`!important`. This is the CSS rule underneath that choice.

## 1. What actually happened

The time range inside a 30-minute lesson block was being cut off. The block was
25px tall; its two lines of content needed 37px. The block's height comes from
the calendar's row height, so the fix was to make rows taller.

First attempt, in `src/index.css`:

```css
.fc-timegrid-slot {
  height: 2.6em;
}
```

After a reload, the row was still 25px. The rule was not malformed, not
misspelled, and not in the wrong file — the browser read it, understood it, and
decided it lost.

It lost to this, which ships inside `@fullcalendar/timegrid`:

```css
.fc .fc-timegrid-slot { border-bottom: 0; height: 1.5em }
```

The fix was to match that selector's shape:

```css
.fc .fc-timegrid-slot {
  height: 2.6em;
}
```

Row height went 25px → 42px, the block went 25px → 41px, and the content stopped
being clipped.

## 2. How the browser picks a winner

When two rules set the same property on the same element, the browser walks a
fixed list of tie-breakers and stops at the first one that separates them:

1. **Origin and importance** — where the rule came from, and whether it is
   `!important`.
2. **Cascade layers** — `@layer` groupings, if any are used.
3. **Specificity** — how precisely the selector describes the element.
4. **Order of appearance** — last one wins.

The mistake that is easy to make is assuming the list starts at step 4. "My rule
comes later in the file, so my rule wins" is only true *after* steps 1–3 have
come out even. Here they did not: step 3 settled it before file order was ever
consulted.

## 3. Specificity, concretely

Specificity is not a single number. It is a three-part tuple, compared
left to right like a version number:

| Column | Counts | Examples |
| --- | --- | --- |
| **A** | IDs | `#calendar` |
| **B** | classes, attributes, pseudo-classes | `.fc`, `[data-open]`, `:hover` |
| **C** | element names, pseudo-elements | `div`, `td`, `::before` |

A higher **A** beats any **B**, and a higher **B** beats any **C**. There is no
carrying: eleven classes do not add up to one ID.

Our two rules:

```
.fc-timegrid-slot         ->  0, 1, 0     (one class)
.fc .fc-timegrid-slot     ->  0, 2, 0     (two classes)
```

`0,2,0` beats `0,1,0`, so FullCalendar's `1.5em` won no matter where our file sat
in the load order. Adding the `.fc` ancestor made ours `0,2,0` as well — and
*then*, with specificity tied, step 4 finally applied and the later rule (ours,
since `index.css` loads after the library's CSS) won.

Two things worth filing away:

- Inline `style="..."` attributes outrank every selector. This is why FullCalendar's
  own event positioning (`inset: 950px 0% -975px`, written inline) cannot be
  overridden with a stylesheet rule at all.
- `:where(...)` always contributes **zero** specificity. `:where(.fc) .fc-timegrid-slot`
  is `0,1,0`, not `0,2,0`. Library authors use it to make rules easy to override.

## 4. What `!important` does

`!important` does not raise specificity. It moves the declaration into a
different, higher bucket at **step 1** — the origin-and-importance step, before
specificity is ever examined.

That is exactly why it would have worked here, instantly, from a one-class
selector. And that is the trap.

## 5. The two fixes, side by side

Both of these make the row 42px tall. Both "work" if you reload once and look at
the screen.

```css
/* A - the !important fix */
.fc-timegrid-slot {
  height: 2.6em !important;
}
```

```css
/* B - the specificity fix (what we shipped) */
.fc .fc-timegrid-slot {
  height: 2.6em;
}
```

The difference is not visible today. It shows up the next time something needs to
touch that height.

### The scenario

Suppose a later iteration adds a toggle for a denser calendar, by putting a
wrapper class around the whole thing. `.calendar-compact` does not exist in the
codebase - it stands in for any future requirement that needs a different row
height. The DOM would look like this:

```html
<div class="calendar-compact">      <!-- your wrapper, added by the toggle -->
  <div class="fc">                  <!-- FullCalendar's own root element -->
    ...
      <td class="fc-timegrid-slot"> <!-- the row both rules want to style -->
```

Three nested classes. The `<td>` at the bottom is the element the base rule and
the new compact rule are competing over.

### What happens next, under A

Say the compact view needs shorter rows:

```css
/* 0,2,0 - more specific than A's 0,1,0, and later in the file. Still loses. */
.calendar-compact .fc-timegrid-slot {
  height: 1.8em;
}
```

This does nothing, because A is `!important` and this is not — importance is
decided at step 1, before specificity is ever compared. The only way out is to
escalate:

```css
.calendar-compact .fc-timegrid-slot {
  height: 1.8em !important;   /* now two !importants compete on specificity */
}
```

Every future rule touching this property now has to carry `!important` forever.
That is how one patch turns into a stylesheet where everything is important and
therefore nothing is.

Measuring code breaks too:

```js
// Temporarily grow a row to test a layout. Silently ignored under A,
// because !important outranks even inline styles.
document.querySelector('.fc-timegrid-slot').style.height = '60px'
```

### What happens next, under B

The same compact-view requirement is an ordinary CSS problem again:

```css
/* 0,3,0 beats B's 0,2,0. No escalation, no !important. */
.calendar-compact .fc .fc-timegrid-slot {
  height: 1.8em;
}
```

And the inline override works, because B is a normal declaration:

```js
document.querySelector('.fc-timegrid-slot').style.height = '60px'  // applies
```

B keeps the cascade available as a tool. A spends it to save four characters.

The practical difference for whoever debugs this later: under B the reason a rule
wins or loses is **visible in the selector itself** - count the classes. Under A
the losing rule looks perfectly correct, and the cause is an `!important` on some
other line of some other file. Adding a class is a local, readable escalation.
Adding `!important` is a global, silent one.

## 6. Why it was the wrong first move anyway

**It hides the diagnosis.** `!important` fixes the symptom whether the real cause
was specificity, load order, a cascade layer, or a typo'd class name that happened
to also match something else. Reaching for it means never learning which of those
it was — and the answer changes what you do next time.

**It escalates, permanently.** Once a declaration is `!important`, the only thing
that can override it in a stylesheet is another `!important` with higher
specificity. Any future rule — a dark mode variant, a compact view, a print
stylesheet — now has to join the arms race. One `!important` tends to breed
several.

**It blocks inline overrides.** A normal declaration can be overridden by an
inline style, which is how most JavaScript sets styles (`el.style.height = ...`).
An `!important` declaration outranks inline styles too, so it can break
animation libraries, measurement code, and FullCalendar's own layout math in ways
that are miserable to trace.

**It says something false.** `!important` means "this matters more than the normal
rules of the cascade". Wanting a 42px row instead of a 25px row is not that. The
honest statement is "inside a FullCalendar, rows are this tall" — which is precisely
what `.fc .fc-timegrid-slot` says.

The ancestor selector costs four characters and keeps every one of those doors
open.

## 7. When `!important` is the right answer

It is a legitimate tool, just not a first resort:

- Overriding **inline styles** written by third-party JavaScript you cannot change.
  This is the main honest use — nothing else can reach them.
- **User stylesheets** and accessibility overrides, where the point is deliberately
  to beat the page author.
- **Print stylesheets**, where forcing backgrounds or colours is the intent.
- Inside a **utility class system** that is designed around it, as an explicit,
  documented policy rather than a one-off patch.

## 8. The modern alternative worth knowing

Cascade layers (`@layer`) settle conflicts at step 2, before specificity. A rule
in a later layer beats a rule in an earlier layer *regardless of how specific
either is*, which is a cleaner way to say "my overrides win" than escalating
selectors.

One wrinkle relevant to this repo: Tailwind v4's `@import "tailwindcss"` puts its
utilities in layers, and **unlayered CSS takes precedence over layered CSS**. Our
rule in `index.css` is unlayered, so it already outranks Tailwind utilities.
FullCalendar's CSS is also unlayered, which is why the contest between the two of
them came down to plain specificity.

## 9. How to check this yourself next time

In DevTools, inspect the element and look at the Styles panel. A declaration that
lost the cascade is shown **struck through**, with the winning rule listed above
it. That single glance distinguishes "my rule lost" from "my rule never matched",
which are completely different bugs with completely different fixes.

To confirm the fix actually landed, measure rather than squint:

```js
const el = document.querySelector('.fc-timegrid-slot')
el.getBoundingClientRect().height   // 25 before, 42 after
```

And for clipping specifically, compare the content box against the content:

```js
inner.scrollHeight > inner.clientHeight   // true = clipped
```

## 10. One trap this incident also exposed

After editing the CSS, the row grew to 42px but the event block stayed 25px.
That was **not** a cascade problem. FullCalendar computes event positions once
and writes them inline as pixels; swapping a stylesheet via hot reload does not
make it recompute. A full page reload did.

So when a CSS change "half works", separate the two questions: *did my
declaration win the cascade* (DevTools strikethrough) and *did the component
re-measure afterwards* (hard reload). They look identical from the outside.
