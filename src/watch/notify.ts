import { WatchEvent } from "./check.js";

/** BAEWATCH_QUIET_HOURS="23-7" sends alerts silently (no sound) between 11 PM and 7 AM local time. */
function quietNow(): boolean {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(process.env.BAEWATCH_QUIET_HOURS || "");
  if (!m) return false;
  const [from, to, h] = [+m[1], +m[2], new Date().getHours()];
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Send alert events to Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
 * Returns false when Telegram isn't configured, so the caller can fall back to stdout.
 */
export async function notifyTelegram(events: WatchEvent[]): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;

  // Telegram caps a message at 4096 chars; send in chunks of ~10 alerts.
  for (let i = 0; i < events.length; i += 10) {
    const lines = events.slice(i, i + 10).map(
      (e) => `🔔 ${escapeHtml(e.text)}${e.link ? `\n<a href="${escapeHtml(e.link)}">Open listing</a>` : ""}`
    );
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `<b>BAEWATCH</b>\n\n${lines.join("\n\n")}`.slice(0, 4096),
        parse_mode: "HTML",
        disable_web_page_preview: events.length > 1,
        disable_notification: quietNow(),
      }),
    });
    if (!res.ok) throw new Error(`Telegram send failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return true;
}
