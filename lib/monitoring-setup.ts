// Хяналтын cron service үүсгэх — server action ба REST хоёулаа энийг дуудна.
import { randomBytes } from "node:crypto";

import { config } from "./config";
import { ensureMonitorService, upsertVariables } from "./railway";

export class SetupError extends Error {}

export async function enableMonitoringCore(): Promise<{ created: boolean; keyCreated: boolean; message: string }> {
  const { projectId, environmentId, serviceId, serviceName, publicUrl } = config.self;
  if (!projectId || !environmentId || !serviceId || !serviceName || !publicUrl)
    throw new SetupError("Console Railway дээр ажиллахгүй байна (RAILWAY_* хувьсагч алга)");
  let keyCreated = false;
  if (!process.env.CONSOLE_API_KEY) {
    await upsertVariables(projectId, environmentId, serviceId, { CONSOLE_API_KEY: randomBytes(24).toString("base64url") }, false);
    keyCreated = true;
  }
  const r = await ensureMonitorService({ projectId, environmentId, consoleServiceName: serviceName, consoleUrl: publicUrl });
  const message = (r.created ? "Хяналтын cron service үүслээ (5 мин тутам)" : "Хяналтын cron service аль хэдийн бий") + (keyCreated ? " · CONSOLE_API_KEY үүсгэж console дахин deploy хийж байна (1–2 мин)" : "");
  return { created: r.created, keyCreated, message };
}
