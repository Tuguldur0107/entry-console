// Deployment-ийн лиценз олгогч — ENTRY_LICENSE token (core талын
// lib/licensing/license.ts үүнийг offline баталгаажуулна).
//
// Token:   entl_<base64url(payload)>.<base64url(Ed25519 sig)>
// Payload: { slug, appUrl, plan?, iat, exp }
//
// Нууц түлхүүр ENTRY_LICENSE_SIGNING_KEY нь ЗӨВХӨН console-ийн орчинд
// (Railway variable) амьдарна — аль ч repo-д орохгүй. Тохируулаагүй бол
// provision зогсохгүй, зөвхөн ENTRY_LICENSE тавигдахгүй (core тал нэвтрэлт
// дээр "бүртгэлгүй" гэж хаана) — ингэснээр түлхүүр тавихаас өмнөх console
// хэвийн ажиллана.

import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

/** Core-той ИЖИЛ public key — beacon дахь ENTRY_LICENSE-ийг баталгаажуулна. */
const ENTRY_LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZCL8o1/RkhL5f+DAO3xDunXXWi4GuWMLzVv397g7Ovw=
-----END PUBLIC KEY-----`;

export type VerifiedLicense = {
  slug: string;
  appUrl: string;
  plan?: string;
  iat: number;
  exp: number;
};

/**
 * Beacon-оос ирсэн ENTRY_LICENSE token-ийг баталгаажуулна (offline). Хүчинтэй
 * бол payload, эс бөгөөс null. Console нь энэ slug/appUrl-ийг итгэж болно —
 * зөвхөн нууц түлхүүрээр зурсан token л энд дамжина.
 */
export function verifyLicenseToken(token: string | null | undefined): VerifiedLicense | null {
  const trimmed = token?.trim();
  if (!trimmed?.startsWith("entl_")) return null;
  const parts = trimmed.slice(5).split(".");
  if (parts.length !== 2) return null;
  try {
    const payloadRaw = Buffer.from(parts[0], "base64url");
    const signature = Buffer.from(parts[1], "base64url");
    const ok = verify(null, payloadRaw, createPublicKey(ENTRY_LICENSE_PUBLIC_KEY), signature);
    if (!ok) return null;
    const payload = JSON.parse(payloadRaw.toString("utf8")) as VerifiedLicense;
    if (typeof payload?.slug !== "string" || typeof payload?.appUrl !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Түлхүүр тохируулагдсан үед л ENTRY_LICENSE автоматаар олгогдоно. */
export function licenseConfigured(): boolean {
  return !!process.env.ENTRY_LICENSE_SIGNING_KEY?.includes("PRIVATE KEY");
}

/**
 * Харилцагчийн deployment-д лицензийн token олгоно. appUrl-даа уягддаг тул
 * өөр домэйнд хуулагдахгүй; дахин олгоход хугацаа нь шинэчлэгдэнэ (deploy
 * бүрд дуудагддаг = сунгалт нь Deploy товч).
 */
export function issueEntryLicense(
  slug: string,
  appUrl: string,
  options: { days?: number; plan?: string } = {}
): string {
  const pem = process.env.ENTRY_LICENSE_SIGNING_KEY;
  if (!pem?.includes("PRIVATE KEY"))
    throw new Error("ENTRY_LICENSE_SIGNING_KEY орчны хувьсагч тохируулаагүй");

  const days = options.days ?? Number(process.env.ENTRY_LICENSE_DAYS || 365);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    slug,
    appUrl: new URL(appUrl).origin,
    ...(options.plan ? { plan: options.plan } : {}),
    iat: now,
    exp: now + Math.round(days * 86400),
  };
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(null, raw, createPrivateKey(pem));
  return `entl_${raw.toString("base64url")}.${signature.toString("base64url")}`;
}
