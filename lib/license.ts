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

import { createPrivateKey, sign } from "node:crypto";

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
