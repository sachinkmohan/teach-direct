# Payments & Stripe

## Revenue Split

**90% to teacher, 10% platform fee** on every confirmed lesson.

## Student Purchase Flow

1. Student browses teachers → selects a package → `PackagePurchase.tsx` modal opens
2. Student enters card via Stripe `CardElement`
3. Frontend calls `purchase-package` Edge Function
4. Edge Function creates a Stripe `PaymentIntent`
5. Frontend confirms payment with Stripe using the returned `client_secret`
6. On success → `packages` record created in DB with `remaining_classes`

## Teacher Payout Flow

1. Teacher completes Stripe Connect onboarding (via `stripe-connect-onboard` Edge Function)
2. `stripe_connect_id` is stored in `teacher_profiles`
3. When a lesson is confirmed → `confirm-lesson` Edge Function executes
4. Stripe transfer: 90% to teacher's Connect account, 10% retained as platform fee
5. `transactions` record created, teacher `balance` updated

## Stripe Notes

- Use test publishable key (`pk_test_...`) in development
- Teachers **must** complete Connect onboarding before they can receive payouts
- The `stripe_connect_status` field tracks onboarding progress

## Key Constraint

Students can only book lessons if `remaining_classes > 0` on their package.
