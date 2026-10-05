// Харилцагчид руу и-мэйл илгээх хуудасны ЦЭВЭР давхарга — fetch, DB, session БАЙХГҮЙ (тесттэй).
// Оролт нь core-ийн GET /api/platform/trial-contacts ба /api/platform/emails хариу.
//
// Илгээлтийг core хийнэ (lib/platform/campaigns-store.ts): Console зөвхөн байгууллагын ID +
// гарчиг + текст өгнө, хаягийг core DB-ээс олно, татгалзсан хэрэглэгчийг алгасна.

export type SaasEmailDelivery = {
  total: number;
  delivered: number;
  failed: number;
  lastAt: string | null;
  lastEvent: string | null;
  lastSubject: string | null;
};

export type SaasTrialContact = {
  organizationId: string;
  orgName: string;
  orgCreatedAt: string;
  planId: string | null;
  subStatus: string | null;
  trialEndsAt: string | null;
  ownerName: string;
  ownerEmail: string;
  emailVerifiedAt: string | null;
  marketingOptOutAt: string | null;
  campaignsReceived: number;
  /** null = Resend уншигдаагүй (мэдэгдэхгүй). */
  delivery: SaasEmailDelivery | null;
};

export type SaasSenderStatus = { from: string | null; domain: string | null; domainStatus: string | null };
export type SaasDeliveryScan = { available: boolean; error: string | null; scanned: number; truncated: boolean };

export type SaasTrialContactsReport = {
  sender: SaasSenderStatus;
  delivery: SaasDeliveryScan;
  contacts: SaasTrialContact[];
};

export type SaasCampaign = {
  id: string;
  subject: string;
  sender: string;
  actor: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  finishedAt: string | null;
};

export type SaasCampaignRecipient = {
  email: string;
  organizationId: string | null;
  orgName: string | null;
  status: string;
  lastEvent: string | null;
  error: string | null;
  lastCheckedAt: string | null;
};

export type SaasCampaignDetail = {
  campaign: { campaignId: string; status: string; recipientCount: number; sentCount: number; failedCount: number; skippedCount: number };
  subject: string;
  body: string;
  sender: string;
  actor: string | null;
  createdAt: string;
  finishedAt: string | null;
  recipients: SaasCampaignRecipient[];
  refreshError: string | null;
};

export type SaasCampaignResult = {
  campaignId: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  duplicate: boolean;
};

/** core-ийн campaigns.ts-тэй ИЖИЛ — Console талд урьдчилан шалгах (core дахин шалгана). */
export const CAMPAIGN_MAX_RECIPIENTS = 500;
export const CAMPAIGN_PLACEHOLDERS = ["name", "company"] as const;

export const CAMPAIGN_STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  sending: { label: "Илгээж байна", badge: "badge-warning" },
  sent: { label: "Илгээсэн", badge: "badge-success" },
  partial: { label: "Хэсэгчлэн", badge: "badge-warning" },
  failed: { label: "Алдаатай", badge: "badge-danger" },
};

export const RECIPIENT_STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  sent: { label: "Илгээсэн", badge: "badge-success" },
  failed: { label: "Алдаатай", badge: "badge-danger" },
  skipped_unsubscribed: { label: "Татгалзсан", badge: "badge-muted" },
};

/** Resend-ийн `last_event`. */
export const DELIVERY_EVENT_LABELS: Record<string, { label: string; badge: string }> = {
  queued: { label: "Дараалалд", badge: "badge-muted" },
  scheduled: { label: "Товлосон", badge: "badge-muted" },
  sent: { label: "Илгээсэн", badge: "badge-muted" },
  delivered: { label: "Хүрсэн", badge: "badge-success" },
  opened: { label: "Нээсэн", badge: "badge-success" },
  clicked: { label: "Линк дарсан", badge: "badge-success" },
  delivery_delayed: { label: "Саатсан", badge: "badge-warning" },
  bounced: { label: "Буцсан", badge: "badge-danger" },
  failed: { label: "Алдаатай", badge: "badge-danger" },
  suppressed: { label: "Хаагдсан", badge: "badge-danger" },
  complained: { label: "Spam гэж тэмдэглэсэн", badge: "badge-danger" },
  canceled: { label: "Цуцалсан", badge: "badge-muted" },
};

export function eventLabel(event: string | null): { label: string; badge: string } | null {
  if (!event) return null;
  return DELIVERY_EVENT_LABELS[event] ?? { label: event, badge: "badge-muted" };
}

export type ContactFilter = "" | "verified" | "unverified" | "never_emailed" | "trialing" | "trial_ending" | "unsubscribed";

export const CONTACT_FILTERS: { value: ContactFilter; label: string }[] = [
  { value: "", label: "Бүгд" },
  { value: "verified", label: "Баталгаажсан" },
  { value: "unverified", label: "Баталгаажаагүй" },
  { value: "never_emailed", label: "Console-оос мэйл аваагүй" },
  { value: "trialing", label: "Туршилтад" },
  { value: "trial_ending", label: "Туршилт 7 хоногт дуусах" },
  { value: "unsubscribed", label: "Татгалзсан" },
];

const DAY_MS = 86_400_000;

/** Шүүлтүүрийн «одоо» — серверийн хуудас хүсэлт бүрд нэг удаа дуудна. */
export function currentTimeMs(): number {
  return Date.now();
}

export function isUnsubscribed(contact: SaasTrialContact): boolean {
  return contact.marketingOptOutAt !== null;
}

function matchesFilter(contact: SaasTrialContact, filter: ContactFilter, now: number): boolean {
  switch (filter) {
    case "verified":
      return contact.emailVerifiedAt !== null;
    case "unverified":
      return contact.emailVerifiedAt === null;
    case "never_emailed":
      return contact.campaignsReceived === 0 && !isUnsubscribed(contact);
    case "trialing":
      return contact.subStatus === "trialing";
    case "trial_ending": {
      if (contact.subStatus !== "trialing" || !contact.trialEndsAt) return false;
      const left = Date.parse(contact.trialEndsAt) - now;
      return left >= 0 && left <= 7 * DAY_MS;
    }
    case "unsubscribed":
      return isUnsubscribed(contact);
    default:
      return true;
  }
}

export function filterTrialContacts(
  contacts: SaasTrialContact[],
  options: { filter: string; q: string; now: number }
): SaasTrialContact[] {
  const filter = (CONTACT_FILTERS.some((f) => f.value === options.filter) ? options.filter : "") as ContactFilter;
  const q = options.q.trim().toLowerCase();
  return contacts.filter(
    (contact) =>
      matchesFilter(contact, filter, options.now) &&
      (!q || [contact.ownerEmail, contact.ownerName, contact.orgName].some((v) => v.toLowerCase().includes(q)))
  );
}

export type TrialContactsSummary = {
  total: number;
  verified: number;
  unsubscribed: number;
  neverEmailed: number;
  /** null = Resend уншигдаагүй. */
  reached: number | null;
  failed: number | null;
};

export function summarizeTrialContacts(contacts: SaasTrialContact[]): TrialContactsSummary {
  const known = contacts.every((c) => c.delivery !== null);
  const count = (pick: (c: SaasTrialContact) => boolean) => contacts.filter(pick).length;
  return {
    total: contacts.length,
    verified: count((c) => c.emailVerifiedAt !== null),
    unsubscribed: count(isUnsubscribed),
    neverEmailed: count((c) => c.campaignsReceived === 0 && !isUnsubscribed(c)),
    reached: known ? count((c) => (c.delivery?.delivered ?? 0) > 0) : null,
    failed: known ? count((c) => (c.delivery?.failed ?? 0) > 0) : null,
  };
}

/** Сонгосон мөрөөс илгээх боломжтойг (татгалзаагүй) үлдээнэ. */
export function sendableIds(contacts: SaasTrialContact[], selected: ReadonlySet<string>): string[] {
  return contacts.filter((c) => selected.has(c.organizationId) && !isUnsubscribed(c)).map((c) => c.organizationId);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Илгээхээс өмнөх шалгалт — алдааны жагсаалт (хоосон = бэлэн). */
export function composeErrors(input: { subject: string; body: string; recipients: number }): string[] {
  const errors: string[] = [];
  if (!input.subject.trim()) errors.push("Гарчиг хоосон байна");
  if (/[\r\n]/.test(input.subject)) errors.push("Гарчиг нэг мөр байна");
  if (!input.body.trim()) errors.push("Текст хоосон байна");
  const allowed = new Set<string>(CAMPAIGN_PLACEHOLDERS);
  const unknown = [...`${input.subject}\n${input.body}`.matchAll(PLACEHOLDER_RE)]
    .map((m) => m[1])
    .filter((key) => !allowed.has(key));
  if (unknown.length) errors.push(`Танихгүй талбар: ${[...new Set(unknown)].map((k) => `{{${k}}}`).join(", ")}`);
  if (input.recipients === 0) errors.push("Хүлээн авагч сонгоогүй байна");
  if (input.recipients > CAMPAIGN_MAX_RECIPIENTS) errors.push(`Нэг удаад ${CAMPAIGN_MAX_RECIPIENTS}-аас олон хүнд илгээхгүй`);
  return errors;
}

/** Урьдчилан харах — {{name}}, {{company}}-г жишээ мөрөөр орлуулна. */
export function previewText(text: string, contact: Pick<SaasTrialContact, "ownerName" | "orgName"> | null): string {
  const vars: Record<string, string> = { name: contact?.ownerName ?? "Нэр", company: contact?.orgName ?? "Компани" };
  return text.replace(PLACEHOLDER_RE, (match, key: string) => vars[key] ?? match);
}
