# Database Schema

All tables live in Supabase (PostgreSQL). Types are defined in `src/types/database.ts`.

## Core Tables

### `users`
User profiles for both students and teachers.

| Column | Notes |
|--------|-------|
| `id` | UUID, matches Supabase Auth user ID |
| `email` | |
| `role` | `'student'` or `'teacher'` |
| `timezone` | IANA timezone string (e.g. `'Europe/London'`) |

### `teacher_profiles`
Extended data for teacher accounts.

| Column | Notes |
|--------|-------|
| `user_id` | FK → `users.id` |
| `stripe_connect_id` | Set after Stripe Connect onboarding |
| `stripe_connect_status` | Onboarding status |
| `balance` | Current available balance |

### `teacher_lesson_offerings`
Duration-based pricing configured by each teacher.

| Column | Notes |
|--------|-------|
| `teacher_id` | FK → `teacher_profiles.user_id` |
| `duration_minutes` | `30`, `45`, or `60` |
| `price` | In pence/cents |
| `active` | Toggle to show/hide from students |

### `packages`
Lesson packages purchased by students.

| Column | Notes |
|--------|-------|
| `student_id` | FK → `users.id` |
| `teacher_id` | FK → `teacher_profiles.user_id` |
| `duration_minutes` | Inherited from the offering at purchase time |
| `total_classes` | Number of lessons in the package |
| `remaining_classes` | Decremented on booking, incremented on cancel |

### `lessons`
Individual lesson bookings.

| Column | Notes |
|--------|-------|
| `package_id` | FK → `packages.id` |
| `scheduled_at` | UTC timestamp |
| `duration_minutes` | Inherited from package |
| `status` | See lifecycle below |

**Lesson status values**: `scheduled` → `pending_confirmation` → `confirmed` / `disputed` / `cancelled`

### `transactions`
Payment history records.

### `monthly_earnings`
Aggregated teacher earnings by month.

## RPC Functions (Atomic Operations)

These are PostgreSQL functions called via `supabase.rpc()`. They run atomically to avoid race conditions.

| Function | What it does |
|----------|-------------|
| `book_lesson_atomic` | Books lesson + decrements `remaining_classes` |
| `cancel_lesson_atomic` | Cancels lesson + refunds `remaining_classes` |
| `complete_lesson_atomic` | Teacher marks lesson complete → `pending_confirmation` |
| `dispute_lesson` | Student disputes → `disputed` |

## When Schema Changes

1. Add migration in `supabase/migrations/`
2. Update TypeScript types in `src/types/database.ts`
3. Run `supabase db push` (remote) or `supabase db reset` (local)
