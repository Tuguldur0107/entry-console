"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import {
  addNote,
  deployCustomerToRailway,
  inviteUser,
  provisionCustomer,
  redeployCustomer,
  setAutoDeploy,
  setCustomerStatus,
  syncAllCustomers,
  syncCustomer,
  updateCustomer,
} from "@/lib/actions";
import type { Customer, CustomerStatus } from "@/lib/db/schema";
import { PLAN_LABELS, STATUS_LABELS } from "./ui";
import { Icons } from "./icons";

export function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`notice ${result.ok ? "notice-success" : "notice-danger"}`} role="status">
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

export function ProvisionForm({ latestTag, owner, railwayOn }: { latestTag: string | null; owner: string; railwayOn: boolean }) {
  const [result, action, pending] = useActionState(provisionCustomer, null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const slugOk = /^[a-z0-9][a-z0-9-]{1,30}$/.test(slug);
  return (
    <form action={action} className="space-y-6">
      <section className="card p-5">
        <h2 className="card-title">1 · Харилцагч</h2>
        <p className="card-sub">Бүртгэл энд хадгалагдана; нэр, холбоо барих мэдээллийг дараа засаж болно.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Харилцагчийн нэр *">
            <input name="display_name" className="input" placeholder="Говь ХК" required value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }} />
          </Field>
          <Field label="Код (repo нэр) *" hint="Жижиг латин үсэг, тоо, зураас · дараа өөрчлөгдөхгүй">
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-3">entry-</span>
              <input name="slug" className="input" placeholder="govi" required pattern="[a-z0-9][a-z0-9-]{1,30}" value={slug}
                aria-invalid={slug ? !slugOk : undefined} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
            </div>
            {slugOk && <p className="mono mt-1.5 text-text-2">→ github.com/{owner}/entry-{slug}</p>}
          </Field>
          <Field label="Регистр / ТТД"><input name="register_no" className="input" placeholder="2107091" /></Field>
          <Field label="Холбоо барих хүн"><input name="contact_name" className="input" placeholder="Б.Бат, нягтлан" /></Field>
          <Field label="Имэйл"><input name="contact_email" className="input" type="email" placeholder="bat@govi.mn" /></Field>
          <Field label="Утас"><input name="contact_phone" className="input" placeholder="9911-2233" /></Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="card-title">2 · Багц, төлбөр</h2>
        <p className="card-sub">Туршилтын үед 0 ₮ үлдээж болно — самбарын MRR энэ утгаас бодогдоно.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Багц">
            <select name="plan" className="select" defaultValue="pilot">
              {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Сарын төлбөр (₮)"><input name="monthly_fee" className="input" inputMode="decimal" defaultValue="0" /></Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="card-title">3 · Техник</h2>
        <p className="card-sub">Core-ийн бүтэн түүхтэй private repo үүсч, upstream-sync тохиргоо, урилга автоматаар хийгдэнэ (~1 мин).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="GitHub хэрэглэгчид (Write эрх)" hint="Таслалаар · харилцагчийн IT / vibe coder · нягтланд хэрэггүй">
            <input name="github_users" className="input" placeholder="bat-erdene, saraa-dev" />
          </Field>
          <Field label="Эхлүүлэх core хувилбар" hint="Release tag (зөвлөж байна) эсвэл main">
            <input name="ref" className="input mono" defaultValue={latestTag ?? "main"} />
          </Field>
          {railwayOn ? (
            <Field label="Хостинг" hint="Railway дээр app + Postgres service үүсч, хаяг автоматаар бүртгэгдэнэ (~5 мин)">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                <input type="checkbox" name="auto_deploy" defaultChecked className="h-4 w-4 accent-[var(--ea-primary)]" />
                Repo бэлэн болмогц Railway-д автоматаар deploy
              </label>
            </Field>
          ) : (
            <Field label="Deploy хаяг" hint="Гараар deploy хийсний дараа ч нэмж болно · Railway тохируулбал автоматаар">
              <input name="app_url" className="input" type="url" placeholder="https://govi.entry.mn" />
            </Field>
          )}
        </div>
      </section>

      <Notice result={result} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending || !slugOk || !name}>
          {pending ? "Илгээж байна…" : "Харилцагч нэмэх → repo үүсгэх"}
        </button>
        <span className="text-xs text-text-3">Дарсны дараа харилцагчийн хуудас руу шилжинэ.</span>
      </div>
    </form>
  );
}

function slugify(s: string): string {
  const map: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",ө:"u",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return s.toLowerCase().split("").map((c) => map[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);
}

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const bound = updateCustomer.bind(null, customer.slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Нэр *"><input name="display_name" className="input" defaultValue={customer.displayName} required /></Field>
        <Field label="Регистр / ТТД"><input name="register_no" className="input" defaultValue={customer.registerNo ?? ""} /></Field>
        <Field label="Холбоо барих хүн"><input name="contact_name" className="input" defaultValue={customer.contactName ?? ""} /></Field>
        <Field label="Имэйл"><input name="contact_email" className="input" type="email" defaultValue={customer.contactEmail ?? ""} /></Field>
        <Field label="Утас"><input name="contact_phone" className="input" defaultValue={customer.contactPhone ?? ""} /></Field>
        <Field label="Deploy хаяг" hint="/api/health-ээс хувилбар уншина">
          <input name="app_url" className="input" defaultValue={customer.appUrl ?? ""} placeholder="https://…" />
        </Field>
        <Field label="Төлөв">
          <select name="status" className="select" defaultValue={customer.status}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Багц">
          <select name="plan" className="select" defaultValue={customer.plan}>
            {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={`Сарын төлбөр (${customer.currency})`}><input name="monthly_fee" className="input" inputMode="decimal" defaultValue={customer.monthlyFee} /></Field>
        <Field label="Төлбөр эхлэх огноо"><input name="billing_starts_at" className="input" type="date" defaultValue={customer.billingStartsAt ?? ""} /></Field>
      </div>
      <Field label="Тэмдэглэл"><textarea name="notes" className="textarea" rows={3} defaultValue={customer.notes ?? ""} /></Field>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "…" : "Хадгалах"}</button>
        <Notice result={result} />
      </div>
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
        <input className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Ref" />
        <button className="btn btn-primary shrink-0" disabled={pending}
          onClick={() => start(async () => { const r = await syncCustomer(slug, ref); setResult(r); if (r.ok) router.refresh(); })}>
          <Icons.refresh className="h-4 w-4" /> {pending ? "…" : "Sync PR нээх"}
        </button>
      </div>
      <Notice result={result} />
    </div>
  );
}

export function SyncAllButton({ latestTag, count }: { latestTag: string | null; count: number }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-sm" disabled={pending || !latestTag || count === 0} title={`${count} идэвхтэй харилцагчид ${latestTag ?? ""} sync`}
        onClick={() => { if (!confirm(`${count} харилцагчийн repo дээр ${latestTag} sync PR нээх үү?`)) return; start(async () => { const r = await syncAllCustomers(); setResult(r); if (r.ok) router.refresh(); }); }}>
        <Icons.refresh className="h-4 w-4" /> {pending ? "…" : `Бүгдийг ${latestTag ?? "—"} болгох`}
      </button>
      <Notice result={result} />
    </div>
  );
}

export function StatusActions({ slug, status }: { slug: string; status: CustomerStatus }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (next: CustomerStatus, msg: string) => () => {
    if (!confirm(msg)) return;
    start(async () => { const r = await setCustomerStatus(slug, next); setResult(r); if (r.ok) router.refresh(); });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" && <button className="btn btn-sm" disabled={pending} onClick={go("suspended", "Түр зогсоох уу? (repo, deploy хэвээр үлдэнэ)")}>Түр зогсоох</button>}
      {status === "suspended" && <button className="btn btn-sm" disabled={pending} onClick={go("active", "Дахин идэвхжүүлэх үү?")}>Идэвхжүүлэх</button>}
      {status !== "archived" && <button className="btn btn-sm btn-danger" disabled={pending} onClick={go("archived", "Архивлах уу? Repo устахгүй, самбараас нуугдана.")}>Архивлах</button>}
      {status === "archived" && <button className="btn btn-sm" disabled={pending} onClick={go("active", "Архиваас сэргээх үү?")}>Сэргээх</button>}
      <Notice result={result} />
    </div>
  );
}

export function DeployPanel({ slug, deployed, connected, autoDeploy, blocker, deployError }: { slug: string; deployed: boolean; connected: boolean; autoDeploy: boolean; blocker: string | null; deployError: string | null }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => () => start(async () => { const r = await fn(); setResult(r); if (r.ok) router.refresh(); });
  return (
    <div className="space-y-3">
      {deployError && <p className={`notice ${deployed && !connected ? "notice-warning" : "notice-danger"}`}><strong>{deployed && !connected ? "Repo холбогдоогүй." : "Сүүлийн оролдлого амжилтгүй."}</strong> {deployError}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!deployed || !connected ? (
          <button className="btn btn-primary" disabled={pending || !!blocker} title={blocker ?? undefined}
            onClick={run(() => deployCustomerToRailway(slug))}>
            <Icons.rocket className="h-4 w-4" /> {pending ? "Үүсгэж байна…" : deployed ? "Repo холбож deploy" : deployError ? "Дахин оролдох" : "Railway-д deploy"}
          </button>
        ) : (
          <button className="btn" disabled={pending} onClick={() => { if (!confirm("Сүүлийн commit-оор дахин deploy хийх үү?")) return; run(() => redeployCustomer(slug))(); }}>
            <Icons.refresh className="h-4 w-4" /> {pending ? "…" : "Дахин deploy"}
          </button>
        )}
        {!deployed && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-2">
            <input type="checkbox" checked={autoDeploy} disabled={pending} className="h-4 w-4 accent-[var(--ea-primary)]"
              onChange={(e) => run(() => setAutoDeploy(slug, e.target.checked))()} />
            Repo бэлэн болмогц автоматаар
          </label>
        )}
      </div>
      {blocker && (!deployed || !connected) && <p className="hint">{blocker}</p>}
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
        <select name="permission" className="select w-28 shrink-0" defaultValue="push">
          <option value="push">Write</option><option value="pull">Read</option><option value="admin">Admin</option>
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
        <input name="message" className="input" placeholder="Тэмдэглэл: уулзалт, тохиролцоо, төлбөр…" required />
        <button className="btn shrink-0" type="submit" disabled={pending}>Нэмэх</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function CopyButton({ text, label = "Хуулах" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* */ } }}>
      {done ? "Хуулагдлаа" : label}
    </button>
  );
}
