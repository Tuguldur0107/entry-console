// Sync push түлхүүрийн ӨӨРӨӨ ЗАСАГДАХ дүрэм — ЦЭВЭР (tests/push-key.test.ts).
//
// Яагаад: `SYNC_PUSH_KEY` механизм нэмэгдэхээс ӨМНӨ эрх авсан харилцагчид push
// түлхүүргүй үлдсэн. Core-ийн шинэчлэлт `.github/workflows/`-ийг хөндмөгц
// GITHUB_TOKEN push хийж чадахгүй тул sync чимээгүй унадаг байв (2026-09-21:
// smartgps, demo хоёулаа). Хяналт (monitor.ts) одоо ийм харилцагчийг илрүүлж
// түлхүүрийг автоматаар үүсгэнэ; үүсгэж чадахгүй бол самбарт ил анхааруулна.

/** Амжилтгүй оролдлогын дараа дахин оролдох хугацаа (GitHub API-г 5 мин тутам цохихгүй). */
export const PUSH_KEY_RETRY_MS = 6 * 60 * 60 * 1000;

export interface PushKeyScope {
  status: string;
  upstreamAccess: boolean;
  syncPushKeyId: number | null;
}

/** Push түлхүүр ЗААВАЛ байх ёстой ч алга: идэвхтэй + шинэчлэлт авах эрхтэй. */
export function needsPushKey(c: PushKeyScope): boolean {
  return c.status === "active" && c.upstreamAccess && c.syncPushKeyId == null;
}

/** Өмнөх амжилтгүй оролдлогоос хойш хангалттай хугацаа өнгөрсөн эсэх. */
export function pushKeyRetryDue(lastAttempt: Date | null | undefined, now: Date): boolean {
  return !lastAttempt || now.getTime() - lastAttempt.getTime() >= PUSH_KEY_RETRY_MS;
}

/** GitHub-ийн алдаанаас засах зааварт хүргэх тайлбар (UI, мэдэгдэл, лог НЭГ текст). */
export function pushKeyFailureText(message: string, owner: string): string {
  const hint = /deploy keys are disabled/i.test(message)
    ? ` — GitHub org «${owner}» дээр deploy key хориглогдсон: Organization Settings → Repository → Deploy keys → зөвшөөрөх`
    : "";
  return `Push түлхүүр үүсгэж чадсангүй: ${message}${hint}. Workflow хөндсөн шинэчлэлт энэ харилцагч дээр унана.`;
}
