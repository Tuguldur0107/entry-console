// Upstream sync-ийн ref сонголт — ЦЭВЭР (DB/GitHub-гүй, tests/sync-ref.test.ts).
//
// Яагаад: sync-ийн ӨМНӨ харилцагчийн workflow файлуудыг core-ийнхтэй тэнцүүлдэг
// (bootstrapSyncWorkflow). Тэнцүүлэлт core-ийн `main`-аас, sync нь release TAG-аас
// байвал хоёрын workflow зөрж, sync салбарын push «workflows permission»-оор
// татгалзагдана (2026-10-02 SmartGPS v1.7.0: ci.yml 2 мөр зөрж 3 удаа унасан).
// Тиймээс тэнцүүлэлт ба sync ЯГ НЭГ ref-ийг хэрэглэнэ.

/**
 * Sync хийх ref: ил заасан → хамгийн сүүлийн release tag → `main`.
 * Хоосон/зай л байвал заагаагүйд тооцно.
 */
export function resolveSyncRef(explicit: string | null | undefined, latestReleaseTag: string | null | undefined): string {
  const ref = explicit?.trim();
  if (ref) return ref;
  const tag = latestReleaseTag?.trim();
  return tag || "main";
}

/** `v1.10.0` / `1.9.2` → [1, 10, 0]; semver биш бол null. */
function parseVersion(v: string | null | undefined): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec((v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Харилцагчийн хувилбар core-ийн сүүлийн release-ЭЭС ХОЦОРСОН эсэх.
 *
 * Яагаад `!==` биш: release tag-гүй commit-оор (SHA) sync хийсэн fork сүүлийн
 * tag-аас ӨМНӨ байж болно (2026-10-02 SmartGPS 1.7.0, сүүлийн tag v1.6.0) — тэгш
 * бусаар харьцуулбал «хоцорсон» гэж 30 мин тутам авто sync эхлүүлж, workflow-ийг
 * хуучин tag руу буцаадаг байв. Хоёулаа semver бол тоогоор; эс бөгөөс тэгш бус.
 * Аль нэг нь алга бол null (мэдэгдэхгүй).
 */
export function isVersionBehind(current: string | null | undefined, latest: string | null | undefined): boolean | null {
  const a = (current ?? "").trim().replace(/^v/, "");
  const b = (latest ?? "").trim().replace(/^v/, "");
  if (!a || !b) return null;
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a !== b;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i];
  return false;
}
