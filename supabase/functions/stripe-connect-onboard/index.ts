import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5174'

    // Debug logging
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasStripeKey: !!stripeSecretKey,
    })

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Create admin client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT and get the user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    console.log('User verification:', { hasUser: !!user, userId: user?.id, error: userError?.message })

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    const email = user.email

    // Get teacher profile using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('teacher_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    console.log('Profile lookup:', { hasProfile: !!profile, error: profileError?.message })

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Teacher profile not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let accountId = profile.stripe_connect_id

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      console.log('Creating new Stripe account for:', email)

      const createAccountRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'standard',
          email: email || '',
        }),
      })

      const account = await createAccountRes.json()

      if (account.error) {
        console.error('Stripe account creation error:', account.error)
        return new Response(
          JSON.stringify({ error: account.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      accountId = account.id
      console.log('Created Stripe account:', accountId)

      // Update teacher profile with account ID
      const { error: updateError } = await supabaseAdmin
        .from('teacher_profiles')
        .update({ stripe_connect_id: accountId })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update teacher profile' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create account link for onboarding
    console.log('Creating account link for:', accountId)

    const accountLinkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${appUrl}/dashboard?stripe_connect=refresh`,
        return_url: `${appUrl}/dashboard?stripe_connect=success`,
        type: 'account_onboarding',
      }),
    })

    const accountLink = await accountLinkRes.json()

    if (accountLink.error) {
      console.error('Account link error:', accountLink.error)
      return new Response(
        JSON.stringify({ error: accountLink.error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Success! Returning onboarding URL')

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
