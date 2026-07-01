# Learn From A Tutor

A peer-to-peer tutoring marketplace where students purchase lesson packages from teachers and book individual lessons against those packages.

## Language

### People

**Student**: A user with role `student` who purchases packages and books lessons.
_Avoid_: Learner, buyer, client

**Teacher**: A user with role `teacher` who delivers lessons and receives payouts via Stripe Connect.
_Avoid_: Tutor, instructor, seller

### Packages & Lessons

**Package**: A single purchase by a student from a specific teacher — a fixed number of lessons at an agreed duration and price. A student may hold multiple Packages with the same teacher simultaneously. A "single lesson" purchase is a Package with `total_classes = 1`; there is no separate single-lesson entity.
_Avoid_: Subscription, bundle, plan

**Remaining Classes**: The integer count of lessons still available in a Package (`packages.remaining_classes`). Decremented when a lesson is booked; incremented when a lesson is cancelled. Synonymous with "remaining lessons" — no further subtraction is applied for already-scheduled lessons, because booking already deducts from this count.
_Avoid_: Available lessons, unused lessons, balance

**Active Package**: A Package with `status = 'active'` and `remaining_classes > 0`. The only packages surfaced to teachers in the student roster and to students in their dashboard.
_Avoid_: Open package, valid package

**Student Name**: A student's `display_name` from the `users` table, falling back to `email` when `display_name` is null.

### Payments

**Platform Fee**: The 10% of each confirmed lesson's value retained by the platform. The teacher receives 90%.
_Avoid_: Commission, cut, service fee

**Pending Balance**: Funds held in the teacher's account for lessons marked `pending_confirmation` but not yet transferred via Stripe.
