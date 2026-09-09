// Харилцагчийг Railway-д deploy хийх ЦӨМ — server action (товч) ба reconcile
// (autoDeploy: repo бэлэн болмогц) хоёулаа энийг дуудна.
//   Урсгал: railway.ts deployCustomer → id-уудыг DB-д → appUrl = https://<domain>
//   → түүхэнд бичнэ. Алдаа → deployError-д хадгалагдана (самбарт анхааруулна).
import { eq } from "drizzle-orm";

import { logEvent } from "./customers";
import { db } from "./db";
import { customers, type Customer } from "./db/schema";
import { deployCustomer, railwayConfigured, redeployService } from "./railway";

export class DeployError extends Error {}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Deploy хийж болох эсэх — болохгүй бол шалтгаан. */
export function deployBlocker(customer: Customer, repoSeeded: boolean): string | null {
  if (!railwayConfigured()) return "Railway тохируулаагүй (Тохиргоо → Railway)";
  if (customer.railwayServiceId) return "Аль хэдийн deploy хийгдсэн — «Дахин deploy» ашигла";
  if (!repoSeeded) return "Repo хараахан бэлэн биш — core түүх push хийгдсэний дараа deploy болно";
  return null;
}

/**
 * Railway дээр service хос үүсгэж deploy эхлүүлнэ. Амжилттай бол Customer
 * (шинэчлэгдсэн) буцаана; алдаа бол deployError-д бичээд DeployError шиднэ.
 */
export async function deployNow(customer: Customer, repoSeeded: boolean): Promise<Customer> {
  const blocker = deployBlocker(customer, repoSeeded);
  if (blocker) throw new DeployError(blocker);
  const steps: string[] = [];
  try {
    const result = await deployCustomer(
      { slug: customer.slug, displayName: customer.displayName, githubRepo: customer.githubRepo },
      (step) => steps.push(step)
    );
    const appUrl = `https://${result.domain}`;
    const [next] = await db
      .update(customers)
      .set({
        railwayProjectId: result.projectId,
        railwayEnvironmentId: result.environmentId,
        railwayServiceId: result.appServiceId,
        railwayPostgresServiceId: result.postgresServiceId,
        appUrl,
        deployError: null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id))
      .returning();
    await logEvent(customer.id, "deploy", `Railway deploy эхэллээ → ${appUrl}`);
    return next;
  } catch (error) {
    const detail = `${msg(error)}${steps.length ? ` (алхам: ${steps[steps.length - 1]})` : ""}`;
    await db.update(customers).set({ deployError: detail, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await logEvent(customer.id, "deploy", `Railway deploy амжилтгүй: ${detail}`);
    throw new DeployError(detail);
  }
}

/** Байгаа service-ийг дахин deploy (сүүлийн commit-оор). */
export async function redeployNow(customer: Customer): Promise<void> {
  if (!customer.railwayServiceId || !customer.railwayEnvironmentId)
    throw new DeployError("Railway service бүртгэлгүй — эхлээд deploy хий");
  try {
    await redeployService(customer.railwayServiceId, customer.railwayEnvironmentId);
    await db.update(customers).set({ deployError: null, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await logEvent(customer.id, "deploy", "Railway дахин deploy эхэллээ");
  } catch (error) {
    throw new DeployError(msg(error));
  }
}
