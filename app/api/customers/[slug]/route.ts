// REST: нэг харилцагч — унших / бүрэн устгах. Нэвтрэлт /api/customers-тай ижил.
//   GET    /api/customers/<slug>            → бүртгэл (DB)
//   DELETE /api/customers/<slug>?confirm=<slug> → Railway app+DB, GitHub repo, бүртгэл устгана
import { authorized } from "../auth";
import { getCustomerBySlug } from "@/lib/customers";
import { destroyCustomer, TeardownError } from "@/lib/teardown";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  return Response.json({ ok: true, customer });
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
