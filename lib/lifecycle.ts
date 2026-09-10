// Төлөв шилжилт: «Түр зогсоох» = Railway app + DB service-ийн deployment-ийг
// устгана (volume, variable, domain хэвээр → төлбөр зогсоно); «Идэвхжүүлэх»
// = дахин deploy. Railway тохируулаагүй/service-гүй бол зөвхөн төлөв солино.
import { logEvent } from "./customers";
import { railwayConfigured, redeployService, stopService } from "./railway";
import type { Customer, CustomerStatus } from "./db/schema";

export class LifecycleError extends Error {}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Төлөв солихын ӨМНӨ Railway талын үйлдлийг хийнэ; тайлбар буцаана. */
export async function applyStatusTransition(customer: Customer, next: CustomerStatus): Promise<string | null> {
  const hasRailway = railwayConfigured() && customer.railwayProjectId && customer.railwayEnvironmentId && customer.railwayServiceId;
  if (!hasRailway) return null;
  const { railwayProjectId: p, railwayEnvironmentId: e, railwayServiceId: app, railwayPostgresServiceId: pg } = customer;
  try {
    if (next === "suspended" && customer.status !== "suspended") {
      const a = await stopService(p!, e!, app!);
      const d = pg ? await stopService(p!, e!, pg) : false;
      const note = `Railway зогсоов: app${a ? " ✓" : " (ажиллаагүй байсан)"}${pg ? `, DB${d ? " ✓" : " (ажиллаагүй байсан)"}` : ""} — volume/өгөгдөл хэвээр`;
      await logEvent(customer.id, "status", note);
      return note;
    }
    if (next === "active" && customer.status === "suspended") {
      if (pg) await redeployService(pg, e!);
      if (customer.railwayRepoConnected) await redeployService(app!, e!);
      const note = `Railway дахин асаав: ${pg ? "DB, " : ""}app deploy эхэллээ (2–4 мин)`;
      await logEvent(customer.id, "status", note);
      return note;
    }
  } catch (error) {
    throw new LifecycleError(`Railway: ${msg(error)}`);
  }
  return null;
}
