// Beacon хүлээн авалт — deployment-ийн дохиог ангилж, DB-д upsert, сэрэмжлүүлнэ.
// Дуудагдана: app/api/beacon/route.ts (нэвтрэлтгүй — итгэл нь лицензийн гарын
// үсэг, бүртгэлтэй харилцагчтай тулгалт).

import { and, eq, sql } from "drizzle-orm";

import { db } from "./db";
import { beacons, customers, type BeaconVerdict } from "./db/schema";
import { verifyLicenseToken } from "./license";
import { notify } from "./notify";

export type BeaconInput = {
  instanceId?: unknown;
  appUrl?: unknown;
  license?: unknown;
  originSlug?: unknown;
  originRepo?: unknown;
  version?: unknown;
  sha?: unknown;
  nodeEnv?: unknown;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const originOf = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return null;
  }
};

export type BeaconResult = {
  verdict: BeaconVerdict;
  slug: string | null;
  alerted: boolean;
};

/**
 * Дохиог ангилж, бүртгэж, шаардвал сэрэмжлүүлнэ. Гол логик:
 *   - Лиценз хүчинтэй + appUrl таарсан + бүртгэлтэй харилцагч → healthy
 *   - Лиценз хүчинтэй ч appUrl зөрсөн → mismatch (env хуулсан)
 *   - Лицензгүй ч origin/лицензийн slug бүртгэлтэй харилцагчийнх → leaked
 *   - Юу ч танигдахгүй → unknown
 * healthy-аас бусад БҮХ verdict нэг instance-д НЭГ л удаа сэрэмжлүүлнэ.
 */
export async function ingestBeacon(input: BeaconInput, ip: string | null): Promise<BeaconResult> {
  const instanceId = str(input.instanceId) ?? "unknown";
  const appUrl = originOf(str(input.appUrl));
  const originSlug = str(input.originSlug);
  const originRepo = str(input.originRepo);
  const version = str(input.version);
  const sha = str(input.sha);
  const nodeEnv = str(input.nodeEnv);

  const license = verifyLicenseToken(str(input.license));
  const licenseSlug = license?.slug ?? null;
  const licensedUrl = license ? originOf(license.appUrl) : null;

  // Аль харилцагчтай холбоотой вэ: (1) лицензийн slug, (2) origin тэмдэг,
  // (3) бодит домэйн — эрэмбээр нь.
  const candidateSlug = licenseSlug ?? originSlug;
  const rows = await db.select().from(customers);
  const bySlug = candidateSlug
    ? rows.find((c) => c.slug === candidateSlug)
    : undefined;
  const byUrl = appUrl
    ? rows.find((c) => originOf(c.appUrl) === appUrl || originOf(c.customDomain) === appUrl)
    : undefined;
  const matched = bySlug ?? byUrl ?? null;

  let verdict: BeaconVerdict;
  if (license && licensedUrl && appUrl && licensedUrl === appUrl) {
    // Лиценз хүчинтэй, домэйндоо ажиллаж байна — хэвийн (бүртгэлд байхгүй ч
    // token хүчинтэй тул итгэнэ; healthy).
    verdict = "healthy";
  } else if (license) {
    // Хүчинтэй лиценз ч өөр домэйнд — env хуулсан хулгайлалт.
    verdict = "mismatch";
  } else if (candidateSlug || matched) {
    // Лицензгүй ч аль харилцагчийнх нь тодорхой — код алдагдсан.
    verdict = "leaked";
  } else {
    verdict = "unknown";
  }

  // Upsert: (instanceId, appUrl) хосоор нэг мөр.
  const existing = await db
    .select()
    .from(beacons)
    .where(
      and(
        eq(beacons.instanceId, instanceId),
        appUrl ? eq(beacons.appUrl, appUrl) : sql`${beacons.appUrl} is null`
      )
    )
    .limit(1);

  let row = existing[0];
  if (row) {
    await db
      .update(beacons)
      .set({
        verdict,
        licenseSlug,
        licensedUrl,
        originSlug,
        originRepo,
        matchedCustomerId: matched?.id ?? null,
        version,
        sha,
        nodeEnv,
        ip,
        lastSeenAt: new Date(),
        hitCount: sql`${beacons.hitCount} + 1`,
      })
      .where(eq(beacons.id, row.id));
  } else {
    [row] = await db
      .insert(beacons)
      .values({
        instanceId,
        appUrl,
        verdict,
        licenseSlug,
        licensedUrl,
        originSlug,
        originRepo,
        matchedCustomerId: matched?.id ?? null,
        version,
        sha,
        nodeEnv,
        ip,
      })
      .returning();
  }

  // Сэрэмжлүүлэг — healthy биш + өмнө нь энэ instance-д сэрэмжлээгүй.
  let alerted = false;
  if (verdict !== "healthy" && !row.alertedAt) {
    const who = matched
      ? `${matched.displayName} (${matched.slug})`
      : candidateSlug
        ? `slug «${candidateSlug}»`
        : "танигдаагүй эх";
    const head =
      verdict === "mismatch"
        ? "⚠️ Лицензийн домэйн зөрүү"
        : verdict === "leaked"
          ? "🚨 Код алдагдсан байж болзошгүй"
          : "❓ Бүртгэлгүй instance";
    const lines = [
      `${head} — Entry beacon`,
      `Эх: ${who}`,
      appUrl ? `Домэйн: ${appUrl}` : null,
      licenseSlug ? `Лиценз: ${licenseSlug}${licensedUrl ? ` (${licensedUrl})` : ""}` : "Лиценз: алга",
      originSlug ? `Гарал үүслийн тэмдэг: ${originSlug}${originRepo ? ` · ${originRepo}` : ""}` : null,
      ip ? `IP: ${ip}` : null,
      version ? `Хувилбар: ${version}${sha ? ` (${sha})` : ""}` : null,
      nodeEnv ? `Орчин: ${nodeEnv}` : null,
    ].filter(Boolean);
    await notify(lines.join("\n"));
    await db.update(beacons).set({ alertedAt: new Date() }).where(eq(beacons.id, row.id));
    alerted = true;
  }

  return { verdict, slug: matched?.slug ?? candidateSlug, alerted };
}
