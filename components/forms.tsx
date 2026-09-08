"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions";
import { inviteUser, provisionCustomer, saveAppUrl, syncCustomer } from "@/lib/actions";

export function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
      {result.ok ? (result.message ?? "Амжилттай") : result.error}
    </p>
  );
}

export function ProvisionForm({ latestTag }: { latestTag: string | null }) {
  const [result, action, pending] = useActionState(provisionCustomer, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="slug">Код (repo нэр) *</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-3">entry-</span>
            <input id="slug" name="slug" className="input" placeholder="govi" required pattern="[a-z0-9][a-z0-9-]{1,30}" />
          </div>
          <p className="hint">Жижиг латин үсэг, тоо, зураас. Дараа өөрчлөгдөхгүй.</p>
        </div>
        <div>
          <label className="label" htmlFor="display_name">Харилцагчийн нэр *</label>
          <input id="display_name" name="display_name" className="input" placeholder="Говь ХК" required />
        </div>
        <div>
          <label className="label" htmlFor="github_users">GitHub хэрэглэгчид (Write эрх)</label>
          <input id="github_users" name="github_users" className="input" placeholder="bat-erdene, saraa-dev" />
          <p className="hint">Таслалаар. Харилцагчийн IT / vibe coder — Claude Code-оор custom/ дээр ажиллана.</p>
        </div>
        <div>
          <label className="label" htmlFor="app_url">Deploy хаяг (сонголтоор)</label>
          <input id="app_url" name="app_url" className="input" placeholder="https://govi.entry.mn" type="url" />
          <p className="hint">Railway-д deploy хийсний дараа ч нэмж болно — хувилбарын самбарт хэрэгтэй.</p>
        </div>
        <div>
          <label className="label" htmlFor="ref">Эхлүүлэх core хувилбар</label>
          <input id="ref" name="ref" className="input" defaultValue={latestTag ?? "main"} />
          <p className="hint">Release tag (зөвлөж байна) эсвэл main.</p>
        </div>
      </div>
      <Notice result={result} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Илгээж байна…" : "Repo үүсгэх"}
      </button>
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

export function AppUrlForm({ slug, appUrl, displayName }: { slug: string; appUrl: string | null; displayName: string }) {
  const bound = saveAppUrl.bind(null, slug);
  const [result, action, pending] = useActionState(bound, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="display_name">Нэр</label>
        <input id="display_name" name="display_name" className="input" defaultValue={displayName} />
      </div>
      <div>
        <label className="label" htmlFor="app_url">Deploy хаяг</label>
        <input id="app_url" name="app_url" className="input" defaultValue={appUrl ?? ""} placeholder="https://…" />
        <p className="hint">Самбар энэ хаягийн /api/health-ээс хувилбарыг уншина.</p>
      </div>
      <Notice result={result} />
      <button className="btn" type="submit" disabled={pending}>Хадгалах</button>
    </form>
  );
}
