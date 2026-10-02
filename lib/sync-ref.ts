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
