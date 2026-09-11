// НЭЭЛТТЭЙ REST: бүртгүүлэх хүсэлт (маркетингийн сайт, Cowork, скрипт) — нэвтрэлт
// шаардахгүй, IP тутамд цагт 5 хүсэлт. Repo/Railway үүсэхгүй — зөвхөн `pending`
// бүртгэл; админ console-оос батална (POST /api/customers/<slug>/approve).
//
//   POST /api/signup  {"companyName":"Говь ХК","contactName":"Б.Бат","email":"bat@govi.mn",
//                      "phone":"9911-2233","registerNo":"2107091","slug":"govi","note":"…"}
//   → 201 {ok:true, slug, status:"pending"}
import { SignupError, submitSignup, type SignupInput } from "@/lib/signup";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let body: SignupInput;
  try {
    body = (await request.json()) as SignupInput;
  } catch {
    return Response.json({ ok: false, error: "JSON body хэрэгтэй" }, { status: 400, headers: CORS });
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "?";
  try {
    const created = await submitSignup(body, ip);
    return Response.json({ ok: true, slug: created.slug, status: created.status }, { status: 201, headers: CORS });
  } catch (error) {
    if (error instanceof SignupError) return Response.json({ ok: false, error: error.message }, { status: 422, headers: CORS });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: CORS });
  }
}
