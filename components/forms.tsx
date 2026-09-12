"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import {
  addNote,
  approveRequestAction,
  approveRequestQuick,
  attachExtras,
  backupNow,
  cleanupOrphanVolumes,
  deployCustomerToRailway,
  destroyCustomerAction,
  enableMonitoring,
  grantUpstream,
  runMonitorNow,
  setAutoSync,
  setCustomDomainAction,
  inviteUser,
  provisionCustomer,
  redeployCustomer,
  rejectRequestAction,
  revokeUpstream,
  setAutoDeploy,
  setCustomerStatus,
  syncAllCustomers,
  syncCustomer,
  updateCustomer,
} from "@/lib/actions";
import { isRequestStatus, type Customer, type CustomerStatus } from "@/lib/db/schema";
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
            {Object.entries(STATUS_LABELS).filter(([k]) => !isRequestStatus(k as CustomerStatus) || k === customer.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
      {status === "suspended" && <button className="btn btn-sm" disabled={pending} onClick={go("active", "Дахин идэвхжүүлэх үү? Railway дээр DB, апп дахин асна (2–4 мин).")}>Идэвхжүүлэх</button>}
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

export function DestroyForm({ slug, items, warnings }: { slug: string; items: string[]; warnings: string[] }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open)
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-2">Railway service (апп + өгөгдлийн сан, өгөгдөл нь хамт), GitHub repo, console-ийн бүртгэл бүгд устна. Буцаах боломжгүй.</p>
        <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>Бүрэн устгах…</button>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="notice notice-danger">
        <strong>Дараах зүйлс бүрмөсөн устна:</strong>
        <ul className="mt-1 list-disc pl-5">
          {items.map((it) => <li key={it}>{it}</li>)}
        </ul>
      </div>
      {warnings.map((w) => <p key={w} className="notice notice-warning">{w}</p>)}
      <label className="block">
        <span className="label">Баталгаажуулахын тулд кодыг бичнэ: <span className="mono">{slug}</span></span>
        <input className="input mono" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={slug} autoFocus />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-danger" disabled={pending || typed.trim() !== slug}
          onClick={() => start(async () => { const r = await destroyCustomerAction(slug, typed); setResult(r); if (r.ok) router.refresh(); else router.refresh(); })}>
          {pending ? "Устгаж байна…" : "Тийм, бүгдийг устга"}
        </button>
        <button className="btn btn-ghost" disabled={pending} onClick={() => { setOpen(false); setTyped(""); setResult(null); }}>Болих</button>
      </div>
      <Notice result={result} />
    </div>
  );
}

function useAction() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => () => start(async () => { const r = await fn(); setResult(r); if (r.ok) router.refresh(); });
  return { result, pending, run };
}

export function AutoSyncToggle({ slug, on }: { slug: string; on: boolean }) {
  const { result, pending, run } = useAction();
  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={on} disabled={pending} className="h-4 w-4 accent-[var(--ea-primary)]" onChange={(e) => run(() => setAutoSync(slug, e.target.checked))()} />
        Авто sync: шинэ release гармагц PR нээж, шалгалт (tsc/lint/test) давсан бол автоматаар merge → Railway deploy
      </label>
      <Notice result={result} />
    </div>
  );
}

export function BackupPanel({ slug, hasVolume, hasDomainSlot }: { slug: string; hasVolume: boolean; hasDomainSlot: boolean }) {
  const { result, pending, run } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!hasVolume || hasDomainSlot ? <button className="btn btn-sm" disabled={pending} onClick={run(() => attachExtras(slug))}>{pending ? "…" : hasVolume ? "Domain үүсгэх" : "Backup идэвхжүүлэх"}</button> : null}
        {hasVolume && <button className="btn btn-sm" disabled={pending} onClick={run(() => backupNow(slug))}>{pending ? "…" : "Backup одоо"}</button>}
      </div>
      <Notice result={result} />
    </div>
  );
}

export function DomainForm({ slug, current }: { slug: string; current: string | null }) {
  const bound = setCustomDomainAction.bind(null, slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="domain" className="input mono" placeholder="govi.entry.mn" defaultValue={current ?? ""} required />
        <button className="btn shrink-0" type="submit" disabled={pending}>{pending ? "…" : current ? "Солих" : "Domain нэмэх"}</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function MonitorButtons({ hasCron, hasKey }: { hasCron: boolean; hasKey: boolean }) {
  const { result, pending, run } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!hasCron && <button className="btn btn-primary btn-sm" disabled={pending} onClick={run(enableMonitoring)}>{pending ? "…" : `Хяналт идэвхжүүлэх (5 мин тутам)${hasKey ? "" : " + API түлхүүр үүсгэх"}`}</button>}
        <button className="btn btn-sm" disabled={pending} onClick={run(runMonitorNow)}>{pending ? "Шалгаж байна…" : "Одоо шалгах"}</button>
        <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => { if (!confirm("Ямар ч service-д холбоогүй volume-уудыг Railway-аас устгах уу? (өгөгдөл нь алга болно)")) return; run(cleanupOrphanVolumes)(); }}>Салангид volume цэвэрлэх</button>
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
      <input name="username" className="input w-full" placeholder="github-username" required />
      <div className="flex gap-2">
        <select name="permission" className="select flex-1" defaultValue="push">
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

// ── Бүртгүүлэх хүсэлт: батлах / татгалзах ──────────────────────────────────

/** Самбарын жагсаалтад — нэг товчоор батлах (сүүлийн release, автомат deploy). */
export function QuickApproveButton({ slug }: { slug: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button className="btn btn-sm btn-primary" disabled={pending}
        onClick={() => { if (!confirm("Батлах уу? GitHub repo + Railway app/DB автоматаар үүснэ (~5 мин).")) return; start(async () => { const r = await approveRequestQuick(slug); setResult(r); if (r.ok) router.refresh(); }); }}>
        <Icons.check className="h-4 w-4" /> {pending ? "…" : "Батлах"}
      </button>
      {result && !result.ok && <span className="text-xs text-danger">{result.error}</span>}
    </span>
  );
}

/** Харилцагчийн хуудас — батлахдаа код, багц, төлбөр, core ref, GitHub эрхийг засаж болно. */
export function ApproveForm({ customer, latestTag, owner, railwayOn }: { customer: Customer; latestTag: string | null; owner: string; railwayOn: boolean }) {
  const bound = approveRequestAction.bind(null, customer.slug);
  const [result, action, pending] = useActionState(bound, null);
  const [slug, setSlug] = useState(customer.slug);
  const slugOk = /^[a-z0-9][a-z0-9-]{1,30}$/.test(slug);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Харилцагчийн нэр *"><input name="display_name" className="input" defaultValue={customer.displayName} required /></Field>
        <Field label="Код (repo нэр) *" hint="Батласны дараа өөрчлөгдөхгүй">
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-3">entry-</span>
            <input name="slug" className="input mono" value={slug} pattern="[a-z0-9][a-z0-9-]{1,30}" aria-invalid={!slugOk || undefined} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          {slugOk && <p className="mono mt-1.5 text-text-2">→ github.com/{owner}/entry-{slug}</p>}
        </Field>
        <Field label="Багц">
          <select name="plan" className="select" defaultValue={customer.plan}>
            {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Сарын төлбөр (₮)"><input name="monthly_fee" className="input" inputMode="decimal" defaultValue={customer.monthlyFee} /></Field>
        <Field label="Эхлүүлэх core хувилбар" hint="Release tag эсвэл main"><input name="ref" className="input mono" defaultValue={latestTag ?? "main"} /></Field>
        <Field label="GitHub хэрэглэгчид (Write эрх)" hint="Таслалаар · заавал биш"><input name="github_users" className="input" placeholder="bat-erdene" /></Field>
        {railwayOn && (
          <Field label="Хостинг" hint="Railway дээр app + Postgres автоматаар (~5 мин)">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
              <input type="checkbox" name="auto_deploy" defaultChecked className="h-4 w-4 accent-[var(--ea-primary)]" />
              Repo бэлэн болмогц Railway-д deploy
            </label>
          </Field>
        )}
        <Field label="Тэмдэглэл (дотоод)"><input name="note" className="input" placeholder="Утсаар ярьсан, pilot 3 сар…" /></Field>
      </div>
      <Notice result={result} />
      <button className="btn btn-primary" type="submit" disabled={pending || !slugOk}>
        <Icons.check className="h-4 w-4" /> {pending ? "Батлаж байна…" : "Батлах → repo, Railway үүсгэх"}
      </button>
    </form>
  );
}

export function RejectForm({ slug }: { slug: string }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Шалтгаан (заавал биш)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn btn-sm btn-danger" disabled={pending}
        onClick={() => { if (!confirm("Хүсэлтийг татгалзах уу? Бүртгэл лавлагаанд үлдэнэ, дараа нь батлах боломжтой.")) return; start(async () => { const r = await rejectRequestAction(slug, reason); setResult(r); if (r.ok) router.refresh(); }); }}>
        {pending ? "…" : "Татгалзах"}
      </button>
      <Notice result={result} />
    </div>
  );
}

/** Хүсэлт (repo/Railway-гүй) устгах — зөвхөн console бүртгэл. */
export function DeleteRequestButton({ slug }: { slug: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <button className="btn btn-sm btn-danger" disabled={pending}
        onClick={() => { if (!confirm("Хүсэлтийг бүрмөсөн устгах уу?")) return; start(async () => { const r = await destroyCustomerAction(slug, slug); setResult(r); if (r.ok) router.push("/customers?status=pending"); }); }}>
        {pending ? "…" : "Хүсэлт устгах"}
      </button>
      <Notice result={result} />
    </div>
  );
}

/**
 * Шинэчлэлт авах эрх — захиалгын гарц. Цуцлахад харилцагчийн байгаа код,
 * deploy огт хөндөгдөхгүй; зөвхөн шинэ хувилбарын PR ирэхээ болино
 * (docs/licensing/README.md).
 */
export function UpstreamAccessPanel({ slug, granted, keyOnCore, secretOnRepo }: { slug: string; granted: boolean; keyOnCore: boolean; secretOnRepo: boolean }) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setResult(r); if (r.ok) { setConfirming(false); setReason(""); router.refresh(); } });
  const broken = granted && (!keyOnCore || !secretOnRepo);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {granted ? <span className="badge badge-success">эрхтэй</span> : <span className="badge badge-muted">цуцлагдсан</span>}
        <span className="text-text-3">core дээр түлхүүр {keyOnCore ? "✓" : "—"} · repo дээр secret {secretOnRepo ? "✓" : "—"}</span>
      </div>
      {broken && (
        <p className="notice notice-warning">
          Эрхтэй гэж бүртгэгдсэн ч {!keyOnCore ? "core repo дээр deploy key олдсонгүй" : "харилцагчийн repo дээр secret олдсонгүй"}. «Түлхүүр шинэчлэх» дарж сэргээнэ.
        </p>
      )}
      {!granted && (
        <p className="text-sm text-text-2">Шинэ хувилбар энэ харилцагч руу очихгүй. Байгаа код, deploy нь хэвийн ажилласаар байна.</p>
      )}
      {confirming ? (
        <div className="space-y-2">
          <input className="input" placeholder="Шалтгаан (төлбөр хоцорсон…)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => run(() => revokeUpstream(slug, reason))}>{pending ? "…" : "Тийм, цуцла"}</button>
            <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => { setConfirming(false); setReason(""); }}>Болих</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {granted ? (
            <>
              <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => setConfirming(true)}>Эрх цуцлах</button>
              <button className="btn btn-sm" disabled={pending} onClick={() => { if (!confirm("Түлхүүрийг шинэчлэх үү? Хуучин түлхүүр ажиллахаа болино.")) return; run(() => grantUpstream(slug)); }}>{pending ? "…" : "Түлхүүр шинэчлэх"}</button>
            </>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => run(() => grantUpstream(slug))}>{pending ? "…" : "Эрх сэргээх"}</button>
          )}
        </div>
      )}
      <Notice result={result} />
    </div>
  );
}
