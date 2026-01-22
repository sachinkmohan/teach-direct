# Stripe Connect Setup Guide (Manual Steps)

This guide covers all the manual steps you can complete in the Stripe Dashboard before we write any code.

---

## Step 1: Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Sign up with your email
3. Verify your email address
4. You'll start in **Test Mode** (perfect for development)

---

## Step 2: Get Your API Keys

### Test Mode Keys (for development):

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy these keys and save them:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`) - Click "Reveal" to see it

### Add to your `.env.local` file:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

### Add to Supabase Secrets:

1. Go to your Supabase project dashboard
2. Click **Project Settings** (gear icon)
3. Click **Edge Functions** in the sidebar
4. Add these secrets:
   - Name: `STRIPE_SECRET_KEY`, Value: `sk_test_YOUR_SECRET_KEY`

---

## Step 3: Enable Stripe Connect

1. Go to https://dashboard.stripe.com/test/connect/accounts/overview
2. Click **Get Started** or **Set up Connect**
3. Choose **Platform or marketplace** (this is for TeachDirect)
4. Fill in business information:
   - **Business name**: TeachDirect (or your business name)
   - **Website**: Your website URL (can be localhost for now)
   - **Support email**: Your email
   - **Business type**: Select appropriate type

---

## Step 4: Configure Connect Settings

### Branding Settings:

1. Go to https://dashboard.stripe.com/test/settings/connect
2. Click **Branding** tab
3. Upload your logo (optional)
4. Set your brand colors
5. These will appear in the Stripe Connect onboarding flow

### Account Settings:

1. Stay in **Connect Settings**
2. Click **Standard accounts** tab
3. Check these settings:
   - **Allow Standard accounts**: ✅ Enabled
   - **Collect capabilities**: ✅ Card payments, ✅ Transfers

### Return URLs (Important!):

1. Still in Connect Settings
2. Add these redirect URLs:
   - Development: `http://localhost:5174/dashboard?stripe_connect=success`
   - Development: `http://localhost:5174/dashboard?stripe_connect=failed`
   - *(Later add production URLs when deploying)*

---

## Step 5: Enable Webhooks

### Create Webhook Endpoint:

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**
3. For now, leave this - we'll add it after deploying Supabase Edge Functions
4. You'll need to add this endpoint URL later:
   - `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/stripe-webhook`

### Events to Listen For (for later):

When you create the webhook, select these events:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated` (for Connect accounts)
- `payout.paid`
- `payout.failed`

---

## Step 6: Test Credit Cards

Use these test cards when testing payments:

| Card Number         | Description            |
| ------------------- | ---------------------- |
| 4242 4242 4242 4242 | Successful payment     |
| 4000 0027 6000 3184 | Requires authentication (3D Secure) |
| 4000 0000 0000 9995 | Always fails           |

**Additional details for all test cards:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

More test cards: https://stripe.com/docs/testing

---

## Step 7: Understand Connect Account Types

For TeachDirect, we're using **Standard Connected Accounts**:

### Why Standard?
- Teachers have their own Stripe dashboard
- Teachers can see their earnings and transactions
- Better for compliance and transparency
- Teachers are responsible for their own taxes

### The Flow:
1. Teacher clicks "Connect Stripe" in your app
2. Teacher is redirected to Stripe's onboarding
3. Teacher fills in their bank details, tax info, etc.
4. Stripe verifies their identity
5. Teacher is redirected back to your app
6. Your app saves their `stripe_account_id`

---

## Step 8: Understand the Payment Flow

### When a Student Purchases a Package:

1. **Create Payment Intent**
   - Amount: Package price
   - Application fee: 10% (your platform fee)
   - Destination: Teacher's connected account

2. **Student Pays**
   - $100 package → $90 goes to teacher, $10 to platform

3. **Funds are Held in Escrow**
   - Teacher's balance is "pending"
   - Not released until lesson is confirmed

4. **Lesson Confirmed**
   - Funds move from pending → available
   - Teacher can withdraw to their bank

---

## Step 9: Payout Settings

### For Connected Accounts (Teachers):

Teachers control their own payouts in their Stripe dashboard:
- **Automatic**: Daily/weekly/monthly
- **Manual**: On-demand

### For Your Platform:

1. Go to https://dashboard.stripe.com/test/settings/payouts
2. Set your payout schedule
3. Add your bank account (even in test mode, for practice)

---

## Step 10: Compliance & Requirements

### What Stripe Will Ask Teachers For:

**Individual accounts:**
- Full legal name
- Date of birth
- Last 4 digits of SSN (US) or tax ID
- Bank account details
- Address

**Business accounts (if teacher has LLC/company):**
- Business legal name
- EIN (Employer Identification Number)
- Business address
- Business bank account
- Representative information

### KYC (Know Your Customer):
- Stripe may ask for ID verification
- May ask for proof of address
- This is automatic and handled by Stripe

---

## Step 11: Test Connect Flow (Manual)

### Before Coding:

1. Go to https://dashboard.stripe.com/test/connect/accounts/overview
2. Click **Create account** manually
3. Fill in test information to see what teachers will see
4. Complete the onboarding
5. See how it appears in your dashboard

This helps you understand the teacher experience!

---

## Step 12: Review Stripe Fees

### Standard Connected Account Fees:

**In the US:**
- **Card payment**: 2.9% + $0.30 per transaction
- **Application fee**: You set this (we'll use 10%)

**Example:**
- Student pays $100 for package
- Stripe takes: $3.20 (2.9% + $0.30)
- Platform takes: $10 (10% application fee)
- Teacher gets: $86.80

**Payouts:**
- Free for standard payouts (1-3 business days)
- Instant payouts: 1.5% (optional, up to $10k/day)

Full pricing: https://stripe.com/pricing

---

## Step 13: Checklist Before Coding

- [ ] Stripe account created
- [ ] Test API keys copied
- [ ] API keys added to `.env.local`
- [ ] Stripe secret added to Supabase
- [ ] Connect enabled in dashboard
- [ ] Branding configured
- [ ] Return URLs added
- [ ] Understand payment flow
- [ ] Tested manual Connect account creation
- [ ] Have test cards ready

---

## Important Links

- **Dashboard**: https://dashboard.stripe.com/test/dashboard
- **API Keys**: https://dashboard.stripe.com/test/apikeys
- **Connect Settings**: https://dashboard.stripe.com/test/settings/connect
- **Webhooks**: https://dashboard.stripe.com/test/webhooks
- **Connected Accounts**: https://dashboard.stripe.com/test/connect/accounts/overview
- **Documentation**: https://stripe.com/docs/connect
- **Testing**: https://stripe.com/docs/testing

---

## Next Steps (For When You Resume Coding)

Once you've completed all the manual steps above, we'll implement:

1. **Stripe Connect Button** - Teachers click to connect
2. **Account Link Generation** - Create onboarding URL
3. **Return Handler** - Process successful/failed connections
4. **Status Display** - Show connection status in dashboard
5. **Payment Intent Creation** - For package purchases
6. **Webhook Handler** - Process payment events

---

## Troubleshooting

### "Connect is not enabled"
- Go to Connect settings and complete the setup wizard

### "Invalid API key"
- Make sure you're using test mode keys (pk_test_ and sk_test_)
- Check for extra spaces when copying

### "Redirect URI mismatch"
- Add your exact return URL in Connect settings
- Include query parameters if any

### "Account already exists"
- Each email can only connect once
- Use different emails for testing multiple accounts
- Or delete test accounts from the dashboard

---

## Production Checklist (For Later)

When going live:
- [ ] Switch to live mode API keys (pk_live_, sk_live_)
- [ ] Update all environment variables
- [ ] Add production webhook endpoint
- [ ] Add production return URLs
- [ ] Verify business information
- [ ] Set up real bank account
- [ ] Complete Stripe's activation requirements
- [ ] Test with real $1 transaction

---

**Ready to code?** Once you've completed these steps, let me know and we'll implement Checkpoint 4!
