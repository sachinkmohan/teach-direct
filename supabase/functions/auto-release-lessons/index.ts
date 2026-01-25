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

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Query lessons that are pending confirmation and past auto-release time
    const { data: lessons, error: queryError } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("status", "pending_confirmation")
      .lte("auto_release_at", new Date().toISOString());

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query lessons" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!lessons || lessons.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No lessons to auto-release",
          processed: 0,
          succeeded: 0,
          failed: 0,
          transfersCreated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Found ${lessons.length} lessons to auto-release`);

    let succeeded = 0;
    let failed = 0;
    let transfersCreated = 0;
    const errors: Array<{ lessonId: string; error: string; stage: string }> = [];

    // Process each lesson
    for (const lesson of lessons) {
      try {
        // Call the release_lesson_funds function - returns transfer details
        const { data: releaseResult, error: rpcError } = await supabaseAdmin.rpc(
          "release_lesson_funds",
          { p_lesson_id: lesson.id },
        );

        if (rpcError) {
          console.error(
            `Failed to release funds for lesson ${lesson.id}:`,
            rpcError,
          );
          failed++;
          errors.push({ lessonId: lesson.id, error: rpcError.message, stage: "database" });
          continue;
        }

        console.log(`Successfully released funds for lesson ${lesson.id}`);

        // Get transfer details from the result
        const transferDetails = releaseResult?.[0];

        if (!transferDetails || !transferDetails.teacher_connect_id) {
          console.error(`No transfer details for lesson ${lesson.id}:`, releaseResult);
          succeeded++; // DB update succeeded
          errors.push({ lessonId: lesson.id, error: "No transfer details returned", stage: "transfer_details" });
          continue;
        }

        const { teacher_connect_id, transfer_amount, teacher_id } = transferDetails;

        // Convert to cents for Stripe
        const transferAmountCents = Math.round(transfer_amount * 100);

        console.log(`Creating Stripe transfer for lesson ${lesson.id}:`, {
          amount: transferAmountCents,
          destination: teacher_connect_id,
        });

        // Create Stripe Transfer to teacher's connected account
        const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `auto-release-${lesson.id}`,
          },
          body: new URLSearchParams({
            amount: transferAmountCents.toString(),
            currency: "eur",
            destination: teacher_connect_id,
            "metadata[lesson_id]": lesson.id,
            "metadata[teacher_id]": teacher_id,
            "metadata[type]": "auto_release",
          }),
        });

        const transfer = await transferRes.json();

        if (transfer.error) {
          console.error(`Stripe transfer error for lesson ${lesson.id}:`, transfer.error);
          succeeded++; // DB update succeeded, but transfer failed
          errors.push({ lessonId: lesson.id, error: transfer.error.message, stage: "stripe_transfer" });
          continue;
        }

        console.log(`Transfer created for lesson ${lesson.id}:`, transfer.id);
        succeeded++;
        transfersCreated++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error processing lesson ${lesson.id}:`, errorMessage);
        failed++;
        errors.push({ lessonId: lesson.id, error: errorMessage, stage: "unknown" });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Auto-release completed",
        processed: lessons.length,
        succeeded,
        failed,
        transfersCreated,
        errors: errors.length > 0 ? errors : undefined,
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
