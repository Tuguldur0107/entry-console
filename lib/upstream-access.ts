// Шинэчлэлт авах эрх — харилцагч бүрд ТУСДАА, цуцлаж болохуйц.
//
// Лицензийн загвар (docs/licensing/README.md): харилцагчид өгөгдсөн код нь
// үүрд тэднийх, ямар ч «унтраах товч» байхгүй. Харин ШИНЭ хувилбар авах нь
// идэвхтэй захиалгын хүрээнд. Техникийн механизм:
//
//   1. Console харилцагч бүрд RSA түлхүүрийн хос үүсгэнэ
//   2. Нийтийн түлхүүр → CORE repo дээр read-only deploy key (`entry-<slug>`)
//   3. Хувийн түлхүүр → харилцагчийн repo-ийн `UPSTREAM_SSH_KEY` secret
//   4. upstream-sync.yml тэр түлхүүрээр core-оос татна
//
// Цуцлах = core дээрх ТЭР НЭГ deploy key-г устгах. Бусад харилцагч хөндөгдөхгүй,
// байгаа код нь ажилласаар байна, зөвхөн шинэ PR ирэхээ болино.
//
// Хувийн түлхүүр console-ийн DB-д ХАДГАЛАГДАХГҮЙ — үүсгэмэгц харилцагчийн
// repo-д шифрлэгдэж очоод санах ойгоос алга болно. Дахин хэрэгтэй бол шинээр
// үүсгэж солино (rotate).
import { eq } from "drizzle-orm";

import { config } from "./config";
import { logEvent } from "./customers";
import { db } from "./db";
import { customers, type Customer } from "./db/schema";
import {
  addDeployKey,
  getFile,
  putFile,
  deleteDeployKey,
  deleteRepoSecret,
  GitHubError,
  hasRepoSecret,
  listDeployKeys,
  setRepoSecret,
} from "./github";
import { generateSshKeyPair } from "./ssh-key";

export class UpstreamAccessError extends Error {}

/** Core repo дээрх deploy key-ийн гарчиг — харилцагчийг таних. */
const keyTitle = (slug: string) => `entry-${slug} (upstream sync)`;
/** Харилцагчийн ӨӨРИЙН repo дээрх бичих түлхүүрийн гарчиг */
const PUSH_KEY_TITLE = "Entry Console (sync push)";
export const SECRET_NAME = "UPSTREAM_SSH_KEY";
export const PUSH_SECRET_NAME = "SYNC_PUSH_KEY";

export interface UpstreamAccessState {
  /** Console-д бүртгэлтэй эрхийн төлөв */
  granted: boolean;
  /** Core repo дээр deploy key бодитоор байгаа эсэх */
  keyOnCore: boolean;
  /** Харилцагчийн repo-д secret байгаа эсэх */
  secretOnRepo: boolean;
  /** Sync салбар push хийх түлхүүр (workflow файл шинэчлэхэд ЗААВАЛ) */
  pushKeyReady: boolean;
  keyId: number | null;
}

/** GitHub-ийн бодит төлөвийг уншина (DB-тэй зөрж болзошгүй тул хоёуланг нь). */
export async function upstreamAccessState(customer: Customer): Promise<UpstreamAccessState> {
  const [keys, secret, pushSecret, pushKeys] = await Promise.all([
    listDeployKeys(config.coreRepo).catch(() => [] as Awaited<ReturnType<typeof listDeployKeys>>),
    hasRepoSecret(customer.githubRepo, SECRET_NAME).catch(() => false),
    hasRepoSecret(customer.githubRepo, PUSH_SECRET_NAME).catch(() => false),
    listDeployKeys(customer.githubRepo).catch(() => [] as Awaited<ReturnType<typeof listDeployKeys>>),
  ]);
  const title = keyTitle(customer.slug);
  const live = keys.find((k) => k.id === customer.upstreamKeyId || k.title === title) ?? null;
  const pushLive = pushKeys.find((k) => k.id === customer.syncPushKeyId || k.title === PUSH_KEY_TITLE) ?? null;
  return {
    granted: customer.upstreamAccess,
    keyOnCore: !!live,
    secretOnRepo: secret,
    pushKeyReady: !!pushLive && pushSecret,
    keyId: live?.id ?? customer.upstreamKeyId ?? null,
  };
}

/**
 * Эрх олгоно (эсвэл түлхүүрийг сольж шинэчилнэ). Хуучин түлхүүр байвал
 * эхлээд устгана — нэг харилцагчид нэг л түлхүүр байх ёстой.
 */
export async function grantUpstreamAccess(customer: Customer): Promise<Customer> {
  const title = keyTitle(customer.slug);
  try {
    // Хуучныг цэвэрлэнэ (id-гаар ч, гарчгаар ч — гараар нэмсэн байж болзошгүй)
    const existing = await listDeployKeys(config.coreRepo).catch(() => []);
    for (const k of existing) {
      if (k.id === customer.upstreamKeyId || k.title === title) await deleteDeployKey(config.coreRepo, k.id);
    }
    const pair = generateSshKeyPair(`entry-${customer.slug}`);
    const key = await addDeployKey(config.coreRepo, title, pair.publicKey);
    await setRepoSecret(customer.githubRepo, SECRET_NAME, pair.privateKey);

    // Хоёр дахь түлхүүр: харилцагчийн ӨӨРИЙН repo дээр БИЧИХ эрхтэй. Sync
    // салбарыг үүгээр push хийнэ — GITHUB_TOKEN нь workflow файл push хийж
    // чаддаггүй. Нэг түлхүүрийг хоёр repo-д бүртгэх боломжгүй тул тусдаа хос.
    const pushExisting = await listDeployKeys(customer.githubRepo).catch(() => []);
    for (const k of pushExisting) {
      if (k.id === customer.syncPushKeyId || k.title === PUSH_KEY_TITLE) await deleteDeployKey(customer.githubRepo, k.id);
    }
    const pushPair = generateSshKeyPair(`entry-${customer.slug}-push`);
    const pushKey = await addDeployKey(customer.githubRepo, PUSH_KEY_TITLE, pushPair.publicKey, { readOnly: false });
    await setRepoSecret(customer.githubRepo, PUSH_SECRET_NAME, pushPair.privateKey);

    const [next] = await db
      .update(customers)
      .set({ upstreamKeyId: key.id, syncPushKeyId: pushKey.id, upstreamAccess: true, updatedAt: new Date() })
      .where(eq(customers.id, customer.id))
      .returning();
    await logEvent(customer.id, "access", "Шинэчлэлт авах эрх олгов (шинэ түлхүүр)");
    return next;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404)
      throw new UpstreamAccessError(
        `${customer.githubRepo} эсвэл ${config.coreRepo} олдсонгүй — repo үүсч дуусаагүй байж магадгүй`
      );
    if (error instanceof GitHubError && error.status === 403)
      throw new UpstreamAccessError(`GitHub эрх хүрэхгүй: ${error.message} — token-д admin эрх хэрэгтэй`);
    throw error;
  }
}

/**
 * Эрхийг цуцална: core дээрх deploy key-г устгаж, харилцагчийн secret-ийг
 * арилгана. Байгаа код, deploy хэвээр — зөвхөн шинэ хувилбар ирэхээ болино.
 */
export async function revokeUpstreamAccess(customer: Customer, reason?: string): Promise<Customer> {
  const title = keyTitle(customer.slug);
  const existing = await listDeployKeys(config.coreRepo).catch(() => []);
  for (const k of existing) {
    if (k.id === customer.upstreamKeyId || k.title === title) await deleteDeployKey(config.coreRepo, k.id);
  }
  // Repo устсан/хандах эрхгүй байж болно — цуцлалт үүнээс болж унахгүй
  await deleteRepoSecret(customer.githubRepo, SECRET_NAME).catch(() => undefined);
  const pushKeys = await listDeployKeys(customer.githubRepo).catch(() => []);
  for (const k of pushKeys) {
    if (k.id === customer.syncPushKeyId || k.title === PUSH_KEY_TITLE)
      await deleteDeployKey(customer.githubRepo, k.id).catch(() => undefined);
  }
  await deleteRepoSecret(customer.githubRepo, PUSH_SECRET_NAME).catch(() => undefined);
  const [next] = await db
    .update(customers)
    .set({ upstreamKeyId: null, syncPushKeyId: null, upstreamAccess: false, autoSync: false, updatedAt: new Date() })
    .where(eq(customers.id, customer.id))
    .returning();
  const note = (reason ?? "").trim();
  await logEvent(customer.id, "access", `Шинэчлэлт авах эрх цуцлав${note ? `: ${note}` : ""} — байгаа код хэвээр`);
  return next;
}

/**
 * Харилцагчийн repo дээрх sync workflow-г core-ийнхтэй тэнцүүлнэ.
 *
 * Яагаад хэрэгтэй вэ: sync нь өөрөө workflow файлаа шинэчилдэг ч GITHUB_TOKEN
 * `.github/workflows/` доторх файлыг push хийж чаддаггүй. Хуучин хувилбарын
 * workflow-той харилцагч (SYNC_PUSH_KEY уншдаггүй) өөрийгөө шинэчилж чадахгүй
 * гэсэн «тахиа-өндөг»-ийн гогцоонд ордог. Console-ийн token-д `workflow` scope
 * байдаг тул файлыг ШУУД бичиж гогцоог таслана.
 *
 * Шинэ харилцагчид хэрэггүй — тэд зөв workflow-тойгоо seed хийгддэг.
 */
const SYNC_WORKFLOW = ".github/workflows/upstream-sync.yml";

export async function bootstrapSyncWorkflow(customer: Customer): Promise<"updated" | "already-current"> {
  const core = await getFile(config.coreRepo, SYNC_WORKFLOW);
  if (!core) throw new UpstreamAccessError(`${config.coreRepo} дээр ${SYNC_WORKFLOW} олдсонгүй`);
  const mine = await getFile(customer.githubRepo, SYNC_WORKFLOW);
  if (mine && mine.content === core.content) return "already-current";
  try {
    await putFile(
      customer.githubRepo,
      SYNC_WORKFLOW,
      core.content,
      "Upstream sync workflow-г core-ийн хувилбартай тэнцүүлэв (Entry Console)",
      mine?.sha
    );
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 403 || error.status === 422))
      throw new UpstreamAccessError(`Workflow файл бичиж чадсангүй: ${error.message} — GITHUB_TOKEN-д \`workflow\` scope хэрэгтэй`);
    throw error;
  }
  await logEvent(customer.id, "access", "Sync workflow core-ийн хувилбартай тэнцүүлэгдэв");
  return "updated";
}
