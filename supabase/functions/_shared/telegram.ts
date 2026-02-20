export interface AlertResult {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

export async function alertTelegram(
  functionName: string,
  flowStep: string,
  error: string,
  extras?: Record<string, string>,
): Promise<AlertResult> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();

  if (!botToken || !chatId) {
    console.error("[alert] Telegram not configured:", functionName, flowStep, error);
    return { ok: false, error: "not_configured" };
  }

  const lines = [
    "\ud83d\udea8 <b>Edge Function Error</b>",
    "",
    `<b>Function:</b> ${functionName}`,
    `<b>Flow Step:</b> ${flowStep}`,
    `<b>Error:</b> ${error}`,
  ];

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value) lines.push(`<b>${key}:</b> ${value}`);
    }
  }

  lines.push(`<b>Time:</b> ${new Date().toISOString()}`);

  const text = lines.join("\n");

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      },
    );
    const respBody = await resp.text();

    if (!resp.ok) {
      console.error("[alert] Telegram API error:", resp.status, respBody);
    }

    return { ok: resp.ok, status: resp.status, body: respBody };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[alert] Telegram send failed:", errMsg);
    return { ok: false, error: errMsg };
  }
}

export async function alertInfo(
  functionName: string,
  message: string,
  extras?: Record<string, string>,
): Promise<AlertResult> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();

  if (!botToken || !chatId) {
    console.error("[alert] Telegram not configured:", functionName, message);
    return { ok: false, error: "not_configured" };
  }

  const lines = [
    "\u26a0\ufe0f <b>Yarro Alert</b>",
    "",
    `<b>Function:</b> ${functionName}`,
    `<b>Message:</b> ${message}`,
  ];

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value) lines.push(`<b>${key}:</b> ${value}`);
    }
  }

  lines.push(`<b>Time:</b> ${new Date().toISOString()}`);

  const text = lines.join("\n");

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      },
    );
    return { ok: resp.ok };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[alert] Telegram send failed:", errMsg);
    return { ok: false, error: errMsg };
  }
}
