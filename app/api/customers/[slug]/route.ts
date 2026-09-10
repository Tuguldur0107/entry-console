// REST: нэг харилцагч — унших / бүрэн устгах. Нэвтрэлт /api/customers-тай ижил.
//   GET    /api/customers/<slug>            → бүртгэл (DB)
//   PATCH  /api/customers/<slug>  {"status":"suspended"|"active"|"archived", "autoSync":true|false, "autoDeploy":true|false}
//   DELETE /api/customers/<slug>?confirm=<slug> → Railway app+DB, GitHub repo, бүртгэл устгана
import { eq } from "drizzle-orm";

import { authorized } from "../auth";
import { getCustomerBySlug, logEvent } from "@/lib/customers";
import { db } from "@/lib/db";
import { CUSTOMER_STATUSES, customers, type CustomerStatus } from "@/lib/db/schema";
import { applyStatusTransition, LifecycleError } from "@/lib/lifecycle";
import { destroyCustomer, TeardownError } from "@/lib/teardown";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  return Response.json({ ok: true, customer });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string; autoSync?: boolean; autoDeploy?: boolean };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const set: Partial<typeof customers.$inferInsert> = {};
  if (typeof body.autoSync === "boolean") set.autoSync = body.autoSync;
  if (typeof body.autoDeploy === "boolean") set.autoDeploy = body.autoDeploy;
  const status = body.status as CustomerStatus | undefined;
  if (status && !CUSTOMER_STATUSES.includes(status)) return Response.json({ ok: false, error: "status буруу" }, { status: 400 });
  if (!status && Object.keys(set).length === 0) return Response.json({ ok: false, error: "status / autoSync / autoDeploy аль нэг нь заавал" }, { status: 400 });
  try {
    let note: string | null = null;
    if (status && status !== customer.status) {
      note = await applyStatusTransition(customer, status);
      set.status = status;
    }
    await db.update(customers).set({ ...set, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    if (set.status) await logEvent(customer.id, "status", `Төлөв: ${customer.status} → ${set.status}`);
    if (typeof body.autoSync === "boolean") await logEvent(customer.id, "sync", body.autoSync ? "Авто sync асаав" : "Авто sync унтраав");
    return Response.json({ ok: true, ...set, note });
  } catch (error) {
    if (error instanceof LifecycleError) return Response.json({ ok: false, error: error.message }, { status: 502 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const confirm = new URL(request.url).searchParams.get("confirm");
  if (confirm !== slug) return Response.json({ ok: false, error: "?confirm=<slug> заавал (буцаах боломжгүй үйлдэл)" }, { status: 400 });
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    await destroyCustomer(customer);
    return Response.json({ ok: true, deleted: slug });
  } catch (error) {
    if (error instanceof TeardownError)
      return Response.json({ ok: false, partial: true, failed: error.failed, error: error.message }, { status: 409 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
