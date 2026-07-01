# Testing Stripe Payments Locally

How to purchase a lesson package locally using Stripe test cards — no real money involved.

## Prerequisites

You need the full local stack running before attempting a purchase. If it's not running yet, follow the [Local Development](/local-dev) guide first. The short checklist:

- Docker Desktop is running
- `npm run local:supabase` has completed (Studio reachable at http://127.0.0.1:54323)
- `npm run local:functions` is running in a separate terminal (required for payments)
- `npm run local:start` is running — app at http://localhost:5174
- `.env.local` contains `pk_test_...` (not `pk_live_...`)
- `supabase/.env.local` contains `sk_test_...`

Quick check:

```bash
cat .env.local | grep STRIPE   # should show pk_test_
```

---

## Stripe Test Cards

Use these card numbers when the Stripe payment form appears. No real charge is ever made in test mode.

| Card Number | Behaviour |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds immediately |
| `4000 0027 6000 3184` | Triggers 3D Secure authentication step |
| `4000 0000 0000 9995` | Payment is always declined |

For **all** test cards, use:
- **Expiry**: any future date — e.g. `12/34`
- **CVC**: any 3 digits — e.g. `123`
- **ZIP / postal code**: any 5 digits — e.g. `12345`

The full Stripe test card catalogue is at https://stripe.com/docs/testing.

---

## Walkthrough: Buy a Package as a Student

### 1. Log in as a student

Go to http://localhost:5174 and sign in with your local test student account (`test-student@example.com` / `password123`).

If you haven't created test users yet, do that now via Supabase Studio → **Authentication → Users → Add User** (see [Local Development → Creating Test Users](/local-dev#creating-test-users)).

### 2. Find a teacher

Navigate to **Browse Teachers** (or go directly to http://localhost:5174/teachers).

You should see the test teacher you created. Click their name or card to open their profile.

If no teachers appear, confirm the test teacher account was created with the correct metadata:
```json
{"role": "teacher", "display_name": "Test Teacher"}
```

### 3. Select a lesson package

On the teacher's profile page you'll see their available packages (e.g. Single Class, 5-Class Package, 10-Class Package).

If the teacher has multiple lesson durations configured (30 / 45 / 60 min), use the duration tabs to switch between them — the pricing updates automatically.

Click **Purchase** on the package you want to buy.

### 4. Enter the test card

The purchase modal opens with a Stripe card form. Enter the test card details:

- **Card number**: `4242 4242 4242 4242`
- **Expiry**: `12/34`
- **CVC**: `123`
- **ZIP**: `12345`

Click **Purchase Package**.

### 5. Confirm payment succeeded

On success you'll see a confirmation message and be redirected to your student dashboard. The new package appears there with the correct number of remaining classes.

---

## Verifying the Purchase in the Database

Open Supabase Studio at http://127.0.0.1:54323 → **Table Editor → packages**.

You should see a new row with:
- `student_id` matching your test student
- `remaining_classes` equal to the package size you purchased
- `duration_minutes` matching the duration you selected
- `status` = `active`

---

## Testing 3D Secure

To exercise the 3D Secure authentication flow, use card `4000 0027 6000 3184` instead. After clicking **Purchase Package**, Stripe's test modal pops up asking you to authenticate. Click **Complete authentication** to simulate success, or **Fail authentication** to simulate failure.

---

## Testing a Declined Card

Use card `4000 0000 0000 9995`. After clicking **Purchase Package**, the payment fails and an error message should appear in the modal. The package should **not** be created in the database.

---

## Gotchas

**Edge Functions must be running.** The `purchase-package` Edge Function creates the Stripe `PaymentIntent`. If Terminal 2 (`npm run local:functions`) isn't running, the purchase call will fail with a network error or 500. Start it before testing payments.

**Teacher must have at least one active offering.** If the teacher profile has no active lesson offerings, the purchase button won't appear. Log in as the teacher, go to their onboarding page (`/teacher/onboarding`), and add at least one duration with pricing.

**Teacher does not need Stripe Connect to complete.** The package purchase goes through Stripe directly (student → platform). The teacher only needs a connected Stripe account when a lesson is *confirmed* and funds are released. You can buy packages locally without setting up Connect.

**Always use test keys locally.** If you accidentally copy a `pk_live_` key into `.env.local`, the Stripe form will attempt real charges. Confirm:
```bash
cat .env.local | grep STRIPE   # must show pk_test_
```

**Supabase Studio is your best debugging tool.** If something looks wrong, check the `packages`, `transactions`, and `lessons` tables directly at http://127.0.0.1:54323.
