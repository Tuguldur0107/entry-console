// Next.js instrumentation — сервер эхлэхэд DB schema-г баталгаажуулна.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return; // build үед / локал schema-гүй
  const { ensureSchema } = await import("./lib/db/ensure");
  try {
    await ensureSchema();
    console.log("[db] schema баталгаажлаа");
  } catch (error) {
    console.error("[db] schema баталгаажуулж чадсангүй:", error);
  }
}
