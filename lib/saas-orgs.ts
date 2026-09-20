// Байгууллагын дэлгэрэнгүй + ДЭМЖЛЭГИЙН ХАНДАЛТ — ЦЭВЭР давхарга (тесттэй).
// Core-ийн /api/platform/organizations ба /api/platform/support-sessions-ийн
// хариуны хэлбэр ба харуулах дүрмүүд. Сүлжээ энд БАЙХГҮЙ (lib/saas-api.ts).

export type SaasOrgMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  emailVerified: boolean;
  joinedAt: string;
};

export type SaasOrgProfile = {
  name: string | null;
  registerNo: string | null;
  vatPayerNo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bankAccountCount: number;
  hasLogo: boolean;
  hasStamp: boolean;
  invoiceFromEmail: string | null;
  emailDomainVerified: boolean;
  aiPostLimitMnt: number | null;
  largeAmountAlertMnt: number | null;
  updatedAt: string | null;
};

export type SaasOrgDetail = {
  organizationId: string;
  name: string;
  registryNo: string | null;
  createdAt: string;
  profile: SaasOrgProfile | null;
  members: SaasOrgMember[];
  disabledModules: string[];
  settings: { isVatPayer: boolean | null; posEnabled: boolean; ebarimtEnabled: boolean };
  usage: {
    journalVouchers: number;
    counterparties: number;
    inventoryItems: number;
    fixedAssets: number;
    cashAccounts: number;
    arApDocuments: number;
    employees: number;
    apiTokens: number;
    closedPeriods: number;
    lastClosedPeriod: string | null;
  };
  lastActivityAt: string | null;
  supportSessions: SaasSupportSession[];
};

export type SaasSupportRole = "viewer" | "admin";
export type SaasSupportState = "pending" | "active" | "expired" | "ended";

export type SaasSupportSession = {
  id: string;
  organizationId: string;
  orgName: string;
  userId: string;
  email: string | null;
  role: SaasSupportRole;
  reason: string | null;
  issuedBy: string | null;
  state: SaasSupportState;
  expiresAt: string;
  startedAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export const SUPPORT_ROLE_LABELS: Record<SaasSupportRole, string> = {
  viewer: "Зөвхөн унших",
  admin: "Бичих, тохиргоо (админ)",
};

export const SUPPORT_STATE_LABELS: Record<SaasSupportState, string> = {
  pending: "Линк хүлээгдэж байна",
  active: "Идэвхтэй",
  expired: "Хугацаа дууссан",
  ended: "Хаагдсан",
};

export const SUPPORT_STATE_BADGE: Record<SaasSupportState, string> = {
  pending: "badge-warning",
  active: "badge-success",
  expired: "badge-muted",
  ended: "badge-muted",
};

/** Гишүүний роль — core-ийн MembershipRole-той ИЖИЛ жагсаалт. */
export const MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: "Эзэн",
  admin: "Админ",
  accountant: "Нягтлан",
  viewer: "Харагч",
};

export const MODULE_LABELS: Record<string, string> = {
  gl: "Ерөнхий журнал",
  cash: "Мөнгөн хөрөнгө",
  ar: "Авлага",
  ap: "Өглөг",
  inv: "Бараа материал",
  pos: "Борлуулалтын цэг",
  cost: "Өртөг",
  proc: "Хангамж",
  fa: "Үндсэн хөрөнгө",
  payroll: "Цалин",
  vat: "НӨАТ",
};

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

/** Идэвхтэй эсвэл хүлээгдэж буй сесс — «одоо нээлттэй байна уу». */
export function openSupportSessions(rows: SaasSupportSession[]): SaasSupportSession[] {
  return rows.filter((row) => row.state === "active" || row.state === "pending");
}

/**
 * Дэмжлэгийн линкийн хүсэлт. И-мэйл нь ОПЕРАТОРЫН Entry данс — core тэр
 * данстай хүн л линкийг ашиглаж чадахаар уядаг. Хоосон бол ШИДЭХГҮЙ,
 * ойлгомжтой алдаа буцаана.
 */
export type SupportRequestParse =
  | { ok: true; value: { email: string; role: SaasSupportRole; reason: string | null } }
  | { ok: false; error: string };

export function parseSupportRequest(input: {
  email: unknown;
  role: unknown;
  reason: unknown;
}): SupportRequestParse {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, error: "Entry дансны и-мэйл шаардлагатай" };
  // Хэлбэрийн энгийн шалгалт — жинхэнэ баталгаа нь core дээрх дансны хайлт.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: `И-мэйлийн хэлбэр буруу: ${email}` };

  const rawRole = typeof input.role === "string" && input.role ? input.role : "viewer";
  if (rawRole !== "viewer" && rawRole !== "admin")
    return { ok: false, error: `Хандалтын түвшин танигдсангүй: ${rawRole}` };

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  return {
    ok: true,
    value: { email, role: rawRole, reason: reason ? reason.slice(0, 300) : null },
  };
}

/** Хүснэгтийн эрэмбэ — ICU-аас хамаарахгүй (hydration зөрөхгүй, byOrgName-тай ижил). */
export function byMemberRole(a: SaasOrgMember, b: SaasOrgMember): number {
  const order = ["owner", "admin", "accountant", "viewer"];
  const ra = order.indexOf(a.role);
  const rb = order.indexOf(b.role);
  if (ra !== rb) return (ra < 0 ? order.length : ra) - (rb < 0 ? order.length : rb);
  const ea = a.email ?? "";
  const eb = b.email ?? "";
  if (ea === eb) return 0;
  return ea < eb ? -1 : 1;
}

/** Профайлын бөглөлтийн түвшин — «хаана дутуу вэ» гэдгийг шууд харуулна. */
export function profileGaps(detail: SaasOrgDetail): string[] {
  const gaps: string[] = [];
  const p = detail.profile;
  if (!p) return ["Компанийн мэдээлэл огт бөглөөгүй"];
  if (!p.name) gaps.push("Компанийн нэр");
  if (!p.registerNo) gaps.push("Регистрийн дугаар");
  if (!p.address) gaps.push("Хаяг");
  if (!p.phone) gaps.push("Утас");
  if (!p.email) gaps.push("И-мэйл");
  if (p.bankAccountCount === 0) gaps.push("Банкны данс");
  return gaps;
}

/** Хэрэглээний хураангуй — байгууллага бодитоор ажиллаж байгаа эсэх. */
export function isOrgActive(detail: SaasOrgDetail): boolean {
  return detail.usage.journalVouchers > 0 || detail.usage.arApDocuments > 0;
}
