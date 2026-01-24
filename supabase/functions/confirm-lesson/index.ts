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
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const { lessonId } = await req.json();

    if (!lessonId) {
      return new Response(
        JSON.stringify({ error: "Lesson ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user is the student for this lesson
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("student_id, status")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: "Lesson not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (lesson.student_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You are not authorized to confirm this lesson" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (lesson.status !== "pending_confirmation") {
      return new Response(
        JSON.stringify({ error: "Lesson is not pending confirmation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Call the release_lesson_funds function
    const { data: releaseResult, error: releaseError } = await supabaseAdmin.rpc(
      "release_lesson_funds",
      { p_lesson_id: lessonId },
    );

    if (releaseError) {
      console.error("Failed to release funds:", releaseError);
      return new Response(
        JSON.stringify({ error: releaseError.message || "Failed to release funds" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // releaseResult is an array with one row containing the transfer details
    const transferDetails = releaseResult?.[0];

    if (!transferDetails || !transferDetails.teacher_connect_id) {
      console.error("No transfer details returned:", releaseResult);
      return new Response(
        JSON.stringify({ error: "Failed to get transfer details" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { teacher_connect_id, transfer_amount, teacher_id } = transferDetails;

    // Convert to cents for Stripe
    const transferAmountCents = Math.round(transfer_amount * 100);

    console.log("Creating Stripe transfer:", {
      amount: transferAmountCents,
      destination: teacher_connect_id,
      lessonId,
    });

    // Create Stripe Transfer to teacher's connected account
    const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: transferAmountCents.toString(),
        currency: "eur",
        destination: teacher_connect_id,
        "metadata[lesson_id]": lessonId,
        "metadata[teacher_id]": teacher_id,
        "metadata[type]": "lesson_confirmation",
      }),
    });

    const transfer = await transferRes.json();

    if (transfer.error) {
      console.error("Stripe transfer error:", transfer.error);
      // Note: Database already updated, but Stripe transfer failed
      // In production, you'd want to handle this with a retry queue
      return new Response(
        JSON.stringify({
          error: "Lesson confirmed but transfer failed. Please contact support.",
          transferError: transfer.error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Transfer created:", transfer.id);

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        amount: transfer_amount,
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
