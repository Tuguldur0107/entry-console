// Мэдэгдэл — Telegram bot ба/эсвэл webhook (Slack/Discord/бусад). Аль нь ч
// тохируулаагүй бол чимээгүй (үйл явдал DB-д хадгалагдсан хэвээр).
import { config } from "./config";

export function alertChannels(): string[] {
  const out: string[] = [];
  if (config.telegram) out.push("Telegram");
  if (config.alertWebhookUrl) out.push("Webhook");
  return out;
}

/** Мэдэгдэл илгээнэ; алдааг залгиж `false` буцаана (хяналтын урсгалыг унагахгүй). */
export async function notify(text: string): Promise<boolean> {
  let sent = false;
  if (config.telegram) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.telegram.chatId, text, disable_web_page_preview: true }),
        cache: "no-store",
      });
      sent ||= r.ok;
    } catch {
      /* дараагийн суваг */
    }
  }
  if (config.alertWebhookUrl) {
    try {
      const r = await fetch(config.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Slack `text`, Discord `content` — хоёуланг өгнө
        body: JSON.stringify({ text, content: text }),
        cache: "no-store",
      });
      sent ||= r.ok;
    } catch {
      /* */
    }
  }
  return sent;
}
