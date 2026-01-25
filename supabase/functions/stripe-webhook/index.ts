import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Verify Stripe webhook signature using Web Crypto API
async function verifyStripeSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  const elements = signature.split(",");
  const timestamp = elements.find((e) => e.startsWith("t="))?.split("=")[1];
  const receivedSignature = elements
    .find((e) => e.startsWith("v1="))
    ?.split("=")[1];

  if (!timestamp || !receivedSignature) {
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (timestampAge > 300) {
    console.error("Webhook timestamp too old:", timestampAge, "seconds");
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === receivedSignature;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
      console.error("Missing environment configuration");
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the event
    const event = JSON.parse(body);
    console.log("Webhook event received:", event.type, event.id);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if event was already processed (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from("webhook_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .single();

    if (existingEvent) {
      console.log("Event already processed:", event.id);
      return new Response(
        JSON.stringify({ received: true, message: "Already processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process the event based on type
    switch (event.type) {
      // ===== Priority 1: Critical for Core Functionality =====

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("Payment succeeded:", paymentIntent.id);

        // Update transaction status
        const { error: txError } = await supabaseAdmin
          .from("transactions")
          .update({ status: "completed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (txError) {
          console.error("Failed to update transaction:", txError);
        }

        // Create package if metadata exists (idempotent via stripe_payment_intent_id)
        const metadata = paymentIntent.metadata;
        if (
          metadata?.student_id &&
          metadata?.teacher_id &&
          metadata?.package_type
        ) {
          // Check if package already exists
          const { data: existingPackage } = await supabaseAdmin
            .from("packages")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntent.id)
            .single();

          if (!existingPackage) {
            const totalClasses = metadata.total_classes
              ? parseInt(metadata.total_classes)
              : 1;
            const pricePerClass = metadata.price_per_class
              ? parseFloat(metadata.price_per_class)
              : paymentIntent.amount / 100 / totalClasses;

            const { error: packageError } = await supabaseAdmin
              .from("packages")
              .insert({
                student_id: metadata.student_id,
                teacher_id: metadata.teacher_id,
                total_classes: totalClasses,
                remaining_classes: totalClasses,
                price_per_class: pricePerClass,
                total_amount: paymentIntent.amount / 100,
                status: "active",
                stripe_payment_intent_id: paymentIntent.id,
              });

            if (packageError) {
              console.error("Failed to create package:", packageError);
            } else {
              console.log(
                "Package created for payment intent:",
                paymentIntent.id
              );
            }
          } else {
            console.log(
              "Package already exists for payment intent:",
              paymentIntent.id
            );
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log("Payment failed:", paymentIntent.id);

        const { error } = await supabaseAdmin
          .from("transactions")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (error) {
          console.error("Failed to update transaction status:", error);
        }
        break;
      }

      // ===== Priority 2: Important for Reliability =====

      case "charge.refunded": {
        const charge = event.data.object;
        console.log("Charge refunded:", charge.id);

        const studentId = charge.metadata?.student_id;
        if (studentId) {
          // Create refund transaction record
          const { error } = await supabaseAdmin.from("transactions").insert({
            user_id: studentId,
            type: "refund",
            amount: charge.amount_refunded / 100,
            status: "completed",
            stripe_payment_intent_id: charge.payment_intent,
            metadata: {
              charge_id: charge.id,
              refund_reason: charge.refund_reason || "requested_by_customer",
            },
          });

          if (error) {
            console.error("Failed to create refund transaction:", error);
          }

          // Optionally restore package classes if full refund
          if (charge.refunded && charge.payment_intent) {
            const { data: pkg } = await supabaseAdmin
              .from("packages")
              .select("id, remaining_classes, total_classes")
              .eq("stripe_payment_intent_id", charge.payment_intent)
              .single();

            if (pkg) {
              const { error: updateError } = await supabaseAdmin
                .from("packages")
                .update({
                  status: "refunded",
                  remaining_classes: pkg.total_classes,
                })
                .eq("id", pkg.id);

              if (updateError) {
                console.error("Failed to update package status:", updateError);
              }
            }
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object;
        console.log("Charge dispute created:", dispute.id);

        // Find the associated transaction and flag it
        if (dispute.payment_intent) {
          const { error } = await supabaseAdmin
            .from("transactions")
            .update({
              metadata: {
                dispute_id: dispute.id,
                dispute_status: dispute.status,
                dispute_reason: dispute.reason,
                disputed_at: new Date().toISOString(),
              },
            })
            .eq("stripe_payment_intent_id", dispute.payment_intent);

          if (error) {
            console.error("Failed to flag disputed transaction:", error);
          }

          // Mark any pending lessons as disputed if associated with this payment
          const { data: pkg } = await supabaseAdmin
            .from("packages")
            .select("id")
            .eq("stripe_payment_intent_id", dispute.payment_intent)
            .single();

          if (pkg) {
            const { error: lessonError } = await supabaseAdmin
              .from("lessons")
              .update({ status: "disputed" })
              .eq("package_id", pkg.id)
              .in("status", ["pending_confirmation"]);

            if (lessonError) {
              console.error("Failed to update lesson status:", lessonError);
            }
          }
        }
        break;
      }

      // ===== Priority 3: Connect Account Management =====

      case "account.updated": {
        const account = event.data.object;
        console.log("Connect account updated:", account.id);

        const chargesEnabled = account.charges_enabled;
        const payoutsEnabled = account.payouts_enabled;
        const detailsSubmitted = account.details_submitted;

        let status: "pending" | "active" | "inactive";
        if (chargesEnabled && payoutsEnabled) {
          status = "active";
        } else if (detailsSubmitted) {
          status = "pending";
        } else {
          status = "inactive";
        }

        const { error } = await supabaseAdmin
          .from("teacher_profiles")
          .update({ stripe_connect_status: status })
          .eq("stripe_connect_id", account.id);

        if (error) {
          console.error("Failed to update Connect status:", error);
        } else {
          console.log(
            "Updated Connect status for",
            account.id,
            "to",
            status
          );
        }
        break;
      }

      case "account.application.deauthorized": {
        const account = event.data.object;
        console.log("Connect account deauthorized:", account.id);

        const { error } = await supabaseAdmin
          .from("teacher_profiles")
          .update({
            stripe_connect_status: "inactive",
            // Keep stripe_connect_id for record-keeping but mark as inactive
          })
          .eq("stripe_connect_id", account.id);

        if (error) {
          console.error("Failed to update deauthorized account:", error);
        }
        break;
      }

      // ===== Priority 4: Payout Tracking (Nice to Have) =====

      case "payout.paid": {
        const payout = event.data.object;
        console.log("Payout completed:", payout.id);

        // Log payout completion for audit trail
        // This would be useful if you implement a withdrawals table
        // For now, just log it
        console.log("Payout details:", {
          amount: payout.amount / 100,
          currency: payout.currency,
          arrival_date: payout.arrival_date,
          destination: payout.destination,
        });
        break;
      }

      case "payout.failed": {
        const payout = event.data.object;
        console.error("Payout failed:", payout.id, payout.failure_message);

        // Log for notification/retry handling
        // In a production system, you might want to notify the teacher
        console.error("Payout failure details:", {
          amount: payout.amount / 100,
          failure_code: payout.failure_code,
          failure_message: payout.failure_message,
        });
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object;
        console.log("Transfer created:", transfer.id);

        // Log for audit trail
        console.log("Transfer details:", {
          amount: transfer.amount / 100,
          currency: transfer.currency,
          destination: transfer.destination,
          lesson_id: transfer.metadata?.lesson_id,
          teacher_id: transfer.metadata?.teacher_id,
          type: transfer.metadata?.type,
        });
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    // Mark event as processed
    const { error: insertError } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        stripe_event_id: event.id,
        type: event.type,
        metadata: {
          object_id: event.data.object.id,
          livemode: event.livemode,
        },
      });

    if (insertError) {
      console.error("Failed to record webhook event:", insertError);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Webhook error:", errorMessage, error);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
