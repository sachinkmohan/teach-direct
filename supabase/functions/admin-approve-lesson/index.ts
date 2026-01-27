import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "ecmalayalam@gmail.com";

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

    // Verify user is the admin
    if (user.email !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body - accepts single lessonId or array of lessonIds
    const body = await req.json();
    const lessonIds: string[] = body.lessonIds
      ? body.lessonIds
      : body.lessonId
        ? [body.lessonId]
        : [];

    if (lessonIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lesson ID(s) required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Admin ${user.email} approving ${lessonIds.length} lesson(s)`);

    const results: Array<{
      lessonId: string;
      success: boolean;
      transferId?: string;
      amount?: number;
      error?: string;
    }> = [];

    // Process each lesson
    for (const lessonId of lessonIds) {
      try {
        // Verify the lesson is in awaiting_admin_approval status
        const { data: lesson, error: lessonError } = await supabaseAdmin
          .from("lessons")
          .select("status")
          .eq("id", lessonId)
          .single();

        if (lessonError || !lesson) {
          results.push({
            lessonId,
            success: false,
            error: "Lesson not found",
          });
          continue;
        }

        if (lesson.status !== "awaiting_admin_approval") {
          results.push({
            lessonId,
            success: false,
            error: `Lesson is not awaiting admin approval (current: ${lesson.status})`,
          });
          continue;
        }

        // Call the admin_approve_lesson function
        const { data: approveResult, error: approveError } =
          await supabaseAdmin.rpc("admin_approve_lesson", {
            p_lesson_id: lessonId,
          });

        if (approveError) {
          console.error(
            `Failed to approve lesson ${lessonId}:`,
            approveError,
          );
          results.push({
            lessonId,
            success: false,
            error: approveError.message || "Failed to approve lesson",
          });
          continue;
        }

        // approveResult is an array with one row containing the transfer details
        const transferDetails = approveResult?.[0];

        if (!transferDetails || !transferDetails.teacher_connect_id) {
          console.error(`No transfer details for lesson ${lessonId}:`, approveResult);
          results.push({
            lessonId,
            success: false,
            error: "Failed to get transfer details",
          });
          continue;
        }

        const { teacher_connect_id, transfer_amount, teacher_id } =
          transferDetails;

        // Convert to cents for Stripe
        const transferAmountCents = Math.round(transfer_amount * 100);

        console.log(`Creating Stripe transfer for lesson ${lessonId}:`, {
          amount: transferAmountCents,
          destination: teacher_connect_id,
        });

        // Create Stripe Transfer to teacher's connected account
        const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `admin-approve-${lessonId}`,
          },
          body: new URLSearchParams({
            amount: transferAmountCents.toString(),
            currency: "eur",
            destination: teacher_connect_id,
            "metadata[lesson_id]": lessonId,
            "metadata[teacher_id]": teacher_id,
            "metadata[type]": "admin_approval",
            "metadata[approved_by]": user.email || "admin",
          }),
        });

        const transfer = await transferRes.json();

        if (transfer.error) {
          console.error(
            `Stripe transfer error for lesson ${lessonId}:`,
            transfer.error,
          );

          // Revert the database changes since Stripe transfer failed
          console.log(`Reverting approval for lesson ${lessonId} due to transfer failure`);
          const { error: revertError } = await supabaseAdmin.rpc(
            "revert_admin_approval",
            { p_lesson_id: lessonId }
          );

          if (revertError) {
            console.error(`Failed to revert lesson ${lessonId}:`, revertError);
            results.push({
              lessonId,
              success: false,
              error: `Transfer failed and revert failed: ${transfer.error.message}. Manual intervention required.`,
            });
          } else {
            results.push({
              lessonId,
              success: false,
              error: `Transfer failed: ${transfer.error.message}. Lesson reverted to awaiting approval.`,
            });
          }
          continue;
        }

        console.log(`Transfer created for lesson ${lessonId}:`, transfer.id);

        results.push({
          lessonId,
          success: true,
          transferId: transfer.id,
          amount: transfer_amount,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error processing lesson ${lessonId}:`, errorMessage);
        results.push({
          lessonId,
          success: false,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Approved ${successCount} of ${lessonIds.length} lessons`,
        results,
        summary: {
          total: lessonIds.length,
          succeeded: successCount,
          failed: failureCount,
        },
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
