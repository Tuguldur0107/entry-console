// Beacon хүлээн авагч — deployment-үүд асахдаа энд POST хийнэ (нэвтрэлтгүй).
// Итгэл нь лицензийн гарын үсэг + бүртгэлтэй харилцагчтай тулгалт (lib/beacon.ts).
// Хэзээ ч алдаа шидэхгүй — 204 буцаана (дохио илгээгч retry хийхгүй, спам болохгүй).

import { ingestBeacon } from "@/lib/beacon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ingestBeacon(body, clientIp(request));
  } catch {
    /* гажиг payload / DB алдаа — чимээгүй залгина, дохиог retry болгохгүй */
  }
  return new Response(null, { status: 204 });
}
