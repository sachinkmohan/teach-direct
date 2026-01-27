import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

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
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { teacherId, packageType, durationMinutes, idempotencyKey } = await req.json();

    if (!teacherId || !packageType || !durationMinutes) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (teacherId, packageType, durationMinutes)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate durationMinutes
    if (![30, 45, 60].includes(durationMinutes)) {
      return new Response(
        JSON.stringify({ error: "Invalid duration. Must be 30, 45, or 60 minutes." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Require idempotency key for payment operations
    if (!idempotencyKey) {
      return new Response(
        JSON.stringify({
          error: "idempotencyKey is required for payment operations",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const stripeIdempotencyKey = idempotencyKey;

    // Get teacher profile for Stripe Connect ID
    const { data: teacherProfile, error: profileError } = await supabaseAdmin
      .from("teacher_profiles")
      .select("*")
      .eq("user_id", teacherId)
      .single();

    if (profileError || !teacherProfile) {
      return new Response(JSON.stringify({ error: "Teacher not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if teacher has Stripe Connect
    if (!teacherProfile.stripe_connect_id) {
      return new Response(
        JSON.stringify({ error: "Teacher has not connected Stripe account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get the offering for this duration from teacher_lesson_offerings
    const { data: offering, error: offeringError } = await supabaseAdmin
      .from("teacher_lesson_offerings")
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("duration_minutes", durationMinutes)
      .eq("is_active", true)
      .single();

    if (offeringError || !offering) {
      return new Response(
        JSON.stringify({ error: "No active offering found for this duration" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Calculate package details from offering
    let totalClasses: number;
    let pricePerClass: number;
    let totalAmount: number;

    if (packageType === "single") {
      totalClasses = 1;
      totalAmount = offering.single_rate;
      pricePerClass = offering.single_rate;
    } else if (packageType === "package_5") {
      if (!offering.package_5_rate) {
        return new Response(
          JSON.stringify({ error: "5-class package not available for this duration" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      totalClasses = 5;
      totalAmount = offering.package_5_rate;
      pricePerClass = offering.package_5_rate / 5;
    } else if (packageType === "package_10") {
      if (!offering.package_10_rate) {
        return new Response(
          JSON.stringify({ error: "10-class package not available for this duration" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      totalClasses = 10;
      totalAmount = offering.package_10_rate;
      pricePerClass = offering.package_10_rate / 10;
    } else {
      return new Response(JSON.stringify({ error: "Invalid package type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInCents = Math.round(totalAmount * 100);

    console.log("Creating payment intent:", {
      amount: amountInCents,
      teacherConnectId: teacherProfile.stripe_connect_id,
    });

    // Create Stripe Payment Intent - money goes to platform account
    // Funds will be transferred to teacher's Connect account only after lesson confirmation
    // Platform fee (10%) is deducted at that time, per lesson
    const paymentIntentRes = await fetch(
      "https://api.stripe.com/v1/payment_intents",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": stripeIdempotencyKey,
        },
        body: new URLSearchParams({
          amount: amountInCents.toString(),
          currency: "eur",
          "metadata[student_id]": user.id,
          "metadata[teacher_id]": teacherId,
          "metadata[package_type]": packageType,
          "metadata[total_classes]": totalClasses.toString(),
          "metadata[price_per_class]": pricePerClass.toString(),
          "metadata[duration_minutes]": durationMinutes.toString(),
          "metadata[teacher_connect_id]": teacherProfile.stripe_connect_id,
        }),
      },
    );

    const paymentIntent = await paymentIntentRes.json();

    if (paymentIntent.error) {
      console.error("Stripe error:", paymentIntent.error);
      return new Response(
        JSON.stringify({ error: paymentIntent.error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Payment intent created:", paymentIntent.id);

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "purchase",
        amount: totalAmount,
        status: "pending",
        stripe_payment_intent_id: paymentIntent.id,
        metadata: {
          teacher_id: teacherId,
          package_type: packageType,
          total_classes: totalClasses,
          duration_minutes: durationMinutes,
        },
      });

    if (transactionError) {
      console.error("Transaction creation error:", transactionError);
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error:", errorMessage, error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
