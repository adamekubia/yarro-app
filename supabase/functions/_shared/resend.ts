// Resend email sending — mirrors sendWhatsApp pattern
// Domain: yarro.ai | From: notifications@yarro.ai

const FROM_EMAIL = "Yarro <notifications@yarro.ai>";

export interface EmailResult {
  ok: boolean;
  emailId?: string;
  error?: string;
  httpStatus?: number;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  if (!to || !subject || !html) {
    return { ok: false, error: "Missing required fields: to, subject, or html" };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (attempt === 0 && (resp.status === 429 || resp.status >= 500)) {
          console.warn(`[resend] ${resp.status} on attempt 1, retrying in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return {
          ok: false,
          error: data.message || JSON.stringify(data),
          httpStatus: resp.status,
        };
      }

      return { ok: true, emailId: data.id };
    } catch (e) {
      if (attempt === 0) {
        console.warn(`[resend] Network error on attempt 1, retrying in 2s:`, e);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { ok: false, error: "Exhausted retries" };
}
