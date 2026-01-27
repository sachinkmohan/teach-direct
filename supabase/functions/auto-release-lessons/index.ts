import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Auto-release lessons after 3 days
// Moves lessons from 'pending_confirmation' to 'awaiting_admin_approval'
// (Admin still needs to approve for funds transfer)
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find lessons that are pending_confirmation and past auto_release_at
    const { data: lessons, error: fetchError } = await supabaseAdmin
      .from("lessons")
      .select("id, student_id")
      .eq("status", "pending_confirmation")
      .lte("auto_release_at", new Date().toISOString());

    if (fetchError) {
      console.error("Failed to fetch lessons:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch lessons" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!lessons || lessons.length === 0) {
      console.log("No lessons to auto-release");
      return new Response(
        JSON.stringify({
          message: "No lessons to auto-release",
          processed: 0,
          succeeded: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Found ${lessons.length} lesson(s) to auto-release`);

    let succeeded = 0;
    let failed = 0;

    // Process each lesson
    for (const lesson of lessons) {
      try {
        // Call student_confirm_lesson to move to awaiting_admin_approval
        const { error: confirmError } = await supabaseAdmin.rpc(
          "student_confirm_lesson",
          {
            p_lesson_id: lesson.id,
            p_student_id: lesson.student_id,
          },
        );

        if (confirmError) {
          console.error(
            `Failed to auto-release lesson ${lesson.id}:`,
            confirmError,
          );
          failed++;
        } else {
          console.log(
            `Auto-released lesson ${lesson.id} to awaiting_admin_approval`,
          );
          succeeded++;
        }
      } catch (err) {
        console.error(`Error processing lesson ${lesson.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Auto-released ${succeeded} of ${lessons.length} lessons`,
        processed: lessons.length,
        succeeded,
        failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
