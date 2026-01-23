import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_WITHDRAWAL_AMOUNT = 1;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const testModeBypass = Deno.env.get("WITHDRAWAL_TEST_MODE_BYPASS") === "true";

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create admin client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get the user
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const { amount } = await req.json();

    if (!amount || typeof amount !== "number") {
      return new Response(
        JSON.stringify({ error: "Amount is required and must be a number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate minimum amount
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return new Response(
        JSON.stringify({
          error: `Minimum withdrawal amount is $${MIN_WITHDRAWAL_AMOUNT}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get teacher profile
    const { data: teacherProfile, error: profileError } = await supabaseAdmin
      .from("teacher_profiles")
      .select("stripe_connect_id, available_balance")
      .eq("user_id", user.id)
      .single();

    if (profileError || !teacherProfile) {
      return new Response(
        JSON.stringify({ error: "Teacher profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate Stripe Connect ID
    if (!teacherProfile.stripe_connect_id) {
      return new Response(
        JSON.stringify({
          error: "Please connect your Stripe account before withdrawing",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate sufficient balance
    const availableBalance = teacherProfile.available_balance || 0;
    if (amount > availableBalance) {
      return new Response(
        JSON.stringify({
          error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Convert to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    console.log("Creating Stripe Transfer:", {
      amount: amountInCents,
      destination: teacherProfile.stripe_connect_id,
    });

    // Check if this is a test key
    const isTestMode = stripeSecretKey.includes("_test_");

    let transfer: { id?: string; error?: { message: string; code?: string } };

    // If test mode bypass is enabled, simulate the withdrawal
    if (testModeBypass && isTestMode) {
      console.log("TEST MODE BYPASS: Simulating withdrawal without calling Stripe");
      transfer = {
        id: `test_tr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };
    } else {

    if (isTestMode) {
      // In test mode, check the Stripe balance first
      const balanceRes = await fetch(
        "https://api.stripe.com/v1/balance",
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Stripe-Account": teacherProfile.stripe_connect_id,
          },
        },
      );

      const balance = await balanceRes.json();

      if (balance.error) {
        console.error("Failed to check Stripe balance:", balance.error);
      } else {
        const availableUSD = balance.available?.find((b: { currency: string }) => b.currency === "usd");
        const availableAmount = availableUSD?.amount || 0;

        console.log("Stripe available balance (cents):", availableAmount);

        if (availableAmount < amountInCents) {
          return new Response(
            JSON.stringify({
              error: "Test Mode: The Stripe Connect account doesn't have sufficient available balance yet. In test mode, funds from payments need time to settle. Please wait a few moments and try again, or test with a smaller amount.",
              testModeInfo: {
                availableInStripe: (availableAmount / 100).toFixed(2),
                requestedAmount: amount.toFixed(2),
                note: "Funds are settling in Stripe test environment"
              }
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

      // Create Stripe Transfer to connected account
      const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: amountInCents.toString(),
          currency: "usd",
          destination: teacherProfile.stripe_connect_id,
          "metadata[user_id]": user.id,
          "metadata[type]": "withdrawal",
        }),
      });

      transfer = await transferRes.json();

      if (transfer.error) {
        console.error("Stripe transfer error:", transfer.error);

        // Provide more helpful error messages
        let errorMessage = transfer.error.message || "Failed to create transfer";

        if (transfer.error.code === "insufficient_funds" && isTestMode) {
          errorMessage = "Test Mode: Insufficient funds in Stripe Connect account. Funds from test payments may take time to settle. Please wait a moment and try again.";
        }

        return new Response(
          JSON.stringify({
            error: errorMessage,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    console.log("Transfer created:", transfer.id);

    // Deduct from available_balance
    const { error: updateError } = await supabaseAdmin
      .from("teacher_profiles")
      .update({
        available_balance: availableBalance - amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update balance:", updateError);
      // Transfer succeeded but balance update failed - log for manual reconciliation
      return new Response(
        JSON.stringify({
          error:
            "Transfer succeeded but balance update failed. Please contact support.",
          transferId: transfer.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        amount: amount,
        status: "completed",
        metadata: {
          stripe_transfer_id: transfer.id,
          destination_account: teacherProfile.stripe_connect_id,
        },
      });

    if (transactionError) {
      console.error("Failed to create transaction record:", transactionError);
      // Non-critical - transfer and balance update succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        amount: amount,
        newBalance: availableBalance - amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error:", errorMessage, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
