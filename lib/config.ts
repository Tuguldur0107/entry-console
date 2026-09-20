// Орчны хувьсагч — нэг газраас, дутуу бол ойлгомжтой алдаа.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} орчны хувьсагч тохируулаагүй (.env.example)`);
  return value;
}

export const config = {
  get password() {
    return required("CONSOLE_PASSWORD");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get githubToken() {
    return required("GITHUB_TOKEN");
  },
  owner: process.env.GITHUB_OWNER ?? "Tuguldur0107",
  ownerType: (process.env.GITHUB_OWNER_TYPE === "org" ? "org" : "user") as "user" | "org",
  coreRepo: process.env.CORE_REPO ?? "Tuguldur0107/entry-accounting",
  /** Харилцагчийн repo-г таних topic (provision-customer.yml тавьдаг). */
  customerTopic: "entry-customer",
  repoPrefix: "entry-",
  /** Харилцагч бүрд <slug>.<baseDomain> custom domain автоматаар (сонголтоор) */
  baseDomain: (process.env.CUSTOMER_BASE_DOMAIN ?? "").trim().replace(/^\.+/, "") || null,
  telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID } : null,
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || null,
  /** Үндсэн SaaS сервис (entry-accounting, saas горим) — багц удирдах платформын API */
  get saas(): { apiUrl: string; apiKey: string } | null {
    const apiUrl = (process.env.ENTRY_SAAS_API_URL ?? "").trim().replace(/\/+$/, "");
    const apiKey = (process.env.ENTRY_SAAS_API_KEY ?? "").trim();
    return apiUrl && apiKey ? { apiUrl, apiKey } : null;
  },
  /**
   * Дэмжлэгийн хандалтын DEFAULT и-мэйл — операторын ӨӨРИЙН Entry данс.
   * Линк тэр данстай хүнд уягддаг тул энэ нь эрх биш, зөвхөн формын default
   * (хүссэн үедээ өөр хаяг бичиж болно).
   */
  supportEmail: (process.env.ENTRY_SUPPORT_EMAIL ?? "").trim().toLowerCase() || null,
  /** Console өөрөө Railway дээр — өөрийн service (хяналтын cron-д хэрэгтэй) */
  self: {
    projectId: process.env.RAILWAY_PROJECT_ID || null,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || null,
    serviceId: process.env.RAILWAY_SERVICE_ID || null,
    serviceName: process.env.RAILWAY_SERVICE_NAME || null,
    publicUrl: process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
  },
};
