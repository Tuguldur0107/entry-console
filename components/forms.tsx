"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import { addNote, inviteUser, provisionCustomer, syncCustomer, updateCustomer } from "@/lib/actions";
import type { Customer } from "@/lib/db/schema";

export const PLAN_LABELS: Record<string, string> = { pilot: "Туршилт", basic: "Basic", pro: "Pro" };
export const STATUS_LABELS: Record<string, string> = {
  provisioning: "Үүсгэж байна",
  active: "Идэвхтэй",
  suspended: "Түр зогссон",
  archived: "Архив",
};

export function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
      {result.ok ? (result.message ?? "Амжилттай") : result.error}
    </p>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function ProvisionForm({ latestTag }: { latestTag: string | null }) {
  const [result, action, pending] = useActionState(provisionCustomer, null);
  return (
    <form action={action} className="space-y-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Харилцагч</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Код (repo нэр) *" hint="Жижиг латин үсэг, тоо, зураас. Дараа өөрчлөгдөхгүй.">
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-3">entry-</span>
              <input name="slug" className="input" placeholder="govi" required pattern="[a-z0-9][a-z0-9-]{1,30}" />
            </div>
          </Field>
          <Field label="Харилцагчийн нэр *">
            <input name="display_name" className="input" placeholder="Говь ХК" required />
          </Field>
          <Field label="Регистр / ТТД">
            <input name="register_no" className="input" placeholder="2107091" />
          </Field>
          <Field label="Холбоо барих хүн">
            <input name="contact_name" className="input" placeholder="Б.Бат, нягтлан" />
          </Field>
          <Field label="Имэйл">
            <input name="contact_email" className="input" type="email" placeholder="bat@govi.mn" />
          </Field>
          <Field label="Утас">
            <input name="contact_phone" className="input" placeholder="9911-2233" />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Багц, төлбөр</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Багц">
            <select name="plan" className="input" defaultValue="pilot">
              {Object.entries(PLAN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Сарын төлбөр (₮)" hint="Туршилтын үед 0 үлдээж болно; дараа засна.">
            <input name="monthly_fee" className="input" inputMode="decimal" defaultValue="0" />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Техник</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub хэрэглэгчид (Write эрх)" hint="Таслалаар. Харилцагчийн IT / vibe coder.">
            <input name="github_users" className="input" placeholder="bat-erdene, saraa-dev" />
          </Field>
          <Field label="Deploy хаяг" hint="Railway-д deploy хийсний дараа ч нэмж болно.">
            <input name="app_url" className="input" type="url" placeholder="https://govi.entry.mn" />
          </Field>
          <Field label="Эхлүүлэх core хувилбар" hint="Release tag (зөвлөж байна) эсвэл main.">
            <input name="ref" className="input" defaultValue={latestTag ?? "main"} />
          </Field>
        </div>
      </section>

      <Notice result={result} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Илгээж байна…" : "Харилцагч нэмэх → repo үүсгэх"}
      </button>
    </form>
  );
}

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const bound = updateCustomer.bind(null, customer.slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Нэр *">
          <input name="display_name" className="input" defaultValue={customer.displayName} required />
        </Field>
        <Field label="Регистр / ТТД">
          <input name="register_no" className="input" defaultValue={customer.registerNo ?? ""} />
        </Field>
        <Field label="Холбоо барих хүн">
          <input name="contact_name" className="input" defaultValue={customer.contactName ?? ""} />
        </Field>
        <Field label="Имэйл">
          <input name="contact_email" className="input" type="email" defaultValue={customer.contactEmail ?? ""} />
        </Field>
        <Field label="Утас">
          <input name="contact_phone" className="input" defaultValue={customer.contactPhone ?? ""} />
        </Field>
        <Field label="Deploy хаяг" hint="/api/health-ээс хувилбар уншина">
          <input name="app_url" className="input" defaultValue={customer.appUrl ?? ""} placeholder="https://…" />
        </Field>
        <Field label="Төлөв">
          <select name="status" className="input" defaultValue={customer.status}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Багц">
          <select name="plan" className="input" defaultValue={customer.plan}>
            {Object.entries(PLAN_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label={`Сарын төлбөр (${customer.currency})`}>
          <input name="monthly_fee" className="input" inputMode="decimal" defaultValue={customer.monthlyFee} />
        </Field>
        <Field label="Төлбөр эхлэх огноо">
          <input name="billing_starts_at" className="input" type="date" defaultValue={customer.billingStartsAt ?? ""} />
        </Field>
      </div>
      <Field label="Тэмдэглэл">
        <textarea name="notes" className="input" rows={3} defaultValue={customer.notes ?? ""} />
      </Field>
      <Notice result={result} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Хадгалах"}</button>
    </form>
  );
}

export function SyncButton({ slug, defaultRef }: { slug: string; defaultRef: string | null }) {
  const [ref, setRef] = useState(defaultRef ?? "main");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Ref" />
        <button
          className="btn btn-primary shrink-0"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncCustomer(slug, ref);
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? "…" : "Sync PR нээх"}
        </button>
      </div>
      <Notice result={result} />
    </div>
  );
}

export function InviteForm({ slug }: { slug: string }) {
  const bound = inviteUser.bind(null, slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="username" className="input" placeholder="github-username" required />
        <select name="permission" className="input w-32 shrink-0" defaultValue="push">
          <option value="push">Write</option>
          <option value="pull">Read</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn shrink-0" type="submit" disabled={pending}>Урих</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function NoteForm({ slug }: { slug: string }) {
  const bound = addNote.bind(null, slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="message" className="input" placeholder="Тэмдэглэл (уулзалт, тохиролцоо…)" required />
        <button className="btn shrink-0" type="submit" disabled={pending}>Нэмэх</button>
      </div>
      <Notice result={result} />
    </form>
  );
}
