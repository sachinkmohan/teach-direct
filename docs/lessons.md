# Lesson Lifecycle

## Status Flow

```text
Package Purchase → remaining_classes set
        ↓
  book_lesson_atomic
        ↓
   "scheduled"  ←── remaining_classes--
        ↓
  Teacher marks complete
        ↓
"pending_confirmation"
        ↓                          ↓
Student confirms           Auto-release after 3 days
        ↓                          ↓
    "confirmed" ←─────────────────┘
        ↓
  Stripe transfer (90/10)
        ↓
  OR "disputed"   (student disputes)
  OR "cancelled"  (cancelled while "scheduled" → remaining_classes++)
```

## Constraints

| Rule | Detail |
|------|--------|
| Booking | Only allowed if `remaining_classes > 0` |
| Cancellation | Only allowed when status is `scheduled` |
| Confirmation | Only the student can manually confirm |
| Auto-release | Lessons auto-confirm 3 days after `pending_confirmation` |
| Disputes | Student can dispute instead of confirming |

## Timezone Handling

- Lesson times stored in UTC
- Displayed in the user's local timezone (from `users.timezone`)
- Use the `useTimezone()` hook for conversions
- `date-fns-tz` handles all timezone math
