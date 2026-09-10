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
  /** Console өөрөө Railway дээр — өөрийн service (хяналтын cron-д хэрэгтэй) */
  self: {
    projectId: process.env.RAILWAY_PROJECT_ID || null,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || null,
    serviceId: process.env.RAILWAY_SERVICE_ID || null,
    serviceName: process.env.RAILWAY_SERVICE_NAME || null,
    publicUrl: process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
  },
};
