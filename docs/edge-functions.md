# Edge Functions

Serverless functions running on Deno via Supabase. Located in `supabase/functions/`.

## Calling from the Frontend

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ },
})
```

## Deploying

```bash
supabase functions deploy               # Deploy all
supabase functions deploy purchase-package  # Deploy one
```

---

## `purchase-package`

Creates a Stripe PaymentIntent when a student buys a lesson package.

**Triggered by**: `PackagePurchase.tsx` modal

**Flow**:
1. Receives teacher ID, duration, and package details
2. Creates Stripe PaymentIntent
3. Returns `client_secret` to frontend
4. Frontend confirms payment via Stripe CardElement
5. Package record created in DB on success

---

## `confirm-lesson`

Releases funds to the teacher after a lesson is confirmed.

**Triggered by**: Student confirming a completed lesson (or auto-release)

**Flow**:
1. Validates lesson is in `pending_confirmation` status
2. Executes Stripe transfer: 90% to teacher's Connect account, 10% platform fee
3. Updates lesson status to `confirmed`
4. Records transaction, updates teacher balance

---

## `stripe-connect-onboard`

Initiates the Stripe Connect onboarding flow for a teacher.

**Triggered by**: Teacher clicking "Connect Stripe" in their profile

**Flow**:
1. Creates or retrieves Stripe Connect account for the teacher
2. Generates onboarding URL
3. Returns URL — frontend redirects teacher to Stripe

---

## `auto-release-lessons`

Auto-confirms lessons that have been in `pending_confirmation` for 3+ days.

**Triggered by**: Scheduled cron (not frontend)

**Flow**:
1. Queries lessons in `pending_confirmation` older than 3 days
2. Calls the same confirm logic as manual confirmation
3. Releases funds to teacher automatically
