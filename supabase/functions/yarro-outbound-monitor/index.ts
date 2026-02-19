import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Monitors replies to the OUTBOUND WhatsApp number (+447463558759).
// People sometimes reply to template messages — this logs those replies
// and sends a Telegram alert so Faraaz can see them.

const FN = "yarro-outbound-monitor";

Deno.serve(async (req: Request) => {
  try {
    // Parse Twilio form-encoded POST
    const formData = await req.text();
    const params = new URLSearchParams(formData);
    const body = params.get("Body") || "(media only)";
    const from = params.get("From") || "";
    const messageSid = params.get("MessageSid") || "";
    const numMedia = parseInt(params.get("NumMedia") || "0", 10);

    const phone = from.replace("whatsapp:", "").replace("+", "");
    if (!phone) return new Response("OK", { status: 200 });

    console.log(`[${FN}] Reply from ${phone}: ${body.slice(0, 120)}`);

    // Log to c1_outbound_log (reuse table, distinct message_type)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("c1_outbound_log").insert({
      message_type: "outbound_reply",
      recipient_phone: phone,
      recipient_role: "unknown",
      body: body + (numMedia > 0 ? ` [+${numMedia} media]` : ""),
      twilio_sid: messageSid,
      status: "received",
      sent_at: new Date().toISOString(),
    });

    // Telegram alert
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
    if (botToken && chatId) {
      const text = [
        "\ud83d\udce9 <b>Outbound Number Reply</b>",
        "",
        `<b>From:</b> +${phone}`,
        `<b>Message:</b> ${body.slice(0, 500)}`,
        numMedia > 0 ? `<b>Media:</b> ${numMedia} attachment(s)` : "",
        `<b>Time:</b> ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }).catch((e) => console.error("[telegram]", e));
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`[${FN}] Error:`, err);
    return new Response("OK", { status: 200 }); // Always 200 for Twilio
  }
});
