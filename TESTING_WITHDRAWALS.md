# Testing Withdrawals in Development

## The Problem

In Stripe test mode, funds from payments to connected accounts take time to settle. When you try to withdraw immediately after a payment, you'll get an "insufficient funds" error because the Stripe Connect account doesn't have available balance yet.

## Solution 1: Enable Test Mode Bypass (Recommended for Testing)

Set an environment variable in your Supabase project to bypass Stripe calls in test mode:

1. Go to your Supabase Dashboard
2. Navigate to Project Settings → Edge Functions → Environment Variables
3. Add a new environment variable:
   - Key: `WITHDRAWAL_TEST_MODE_BYPASS`
   - Value: `true`

4. Redeploy the withdraw-funds function:
```bash
supabase functions deploy withdraw-funds
```

This will simulate withdrawals without calling Stripe when using test API keys.

## Solution 2: Wait for Stripe Settlement

In test mode, funds typically settle within a few minutes. You can:

1. Make a payment (purchase a package)
2. Complete a lesson and confirm it
3. Wait 2-3 minutes
4. Try withdrawing again

## Solution 3: Add Test Funds Directly

Use the special test card `4000000000000077` to add funds directly:

1. Create a charge to the connected account using this test card
2. This will immediately add available balance
3. Then you can test withdrawals

## Production

In production with real Stripe keys and real bank accounts, this issue doesn't exist. Funds settle normally and withdrawals work as expected.

## Error Messages

The updated withdraw function now provides clearer error messages:
- Shows available balance in Stripe Connect account
- Explains that funds are settling in test mode
- Suggests waiting and trying again
