"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteSaasOrganizationAction, resetSaasOrganizationAction, type ActionResult } from "@/lib/actions";

import { Notice } from "./forms";

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Байгууллагын ГҮЙЛГЭЭГ цэвэрлэх — core-ийн POST /api/platform/organizations/reset.
 * Мастер дата, тохиргоо, гишүүд, холболт ҮЛДЭНЭ (туршилтын өгөгдлөөс цэвэр эхлэх).
 * Баталгаажуулалт устгалтынхтай ижил — нэрийг яг бичнэ.
 */
export function SaasOrgResetZone({ organizationId, orgName }: { organizationId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open)
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">Гүйлгээг цэвэрлэх — мастер дата, тохиргоо, гишүүд үлдэнэ.</p>
          <button className="btn btn-sm btn-danger" onClick={() => { setResult(null); setOpen(true); }}>Гүйлгээг цэвэрлэх…</button>
        </div>
        <Notice result={result} />
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="notice notice-warning">
        <strong>«{orgName}»-ийн гүйлгээ бүгд устна:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Журнал, касс, АР/АП, бараа материалын хөдөлгөөн, цалин, POS, татварын ноорог</li>
          <li>Үлдэнэ: данс, харилцагч, бараа, ажилтан, тохиргоо, банк/татварын холболт, гишүүд</li>
          <li>ТЕГ-д бүртгэлтэй eBarimt эсвэл илгээгдэж буй илгээлттэй бол core татгалзана</li>
        </ul>
      </div>
      <label className="block">
        <span className="label">Баталгаажуулахын тулд нэрийг яг бичнэ: <span className="font-medium">{orgName}</span></span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={orgName} autoFocus />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-danger"
          disabled={pending || !sameName(typed, orgName)}
          onClick={() =>
            start(async () => {
              const r = await resetSaasOrganizationAction(organizationId, typed);
              setResult(r);
              if (r.ok) {
                setTyped("");
                setOpen(false);
                router.refresh();
              }
            })
          }
        >
          {pending ? "Цэвэрлэж байна…" : "Тийм, гүйлгээг цэвэрлэ"}
        </button>
        <button className="btn btn-ghost" disabled={pending} onClick={() => { setOpen(false); setTyped(""); setResult(null); }}>Болих</button>
      </div>
      <Notice result={result} />
    </div>
  );
}

/**
 * SaaS байгууллагыг БҮРМӨСӨН устгах — core-ийн DELETE /api/platform/organizations.
 * Баталгаажуулалт: нэрийг яг бичнэ (харилцагчийн «Бүрэн устгах»-тай ижил хэв маяг).
 */
export function SaasOrgDangerZone({
  organizationId,
  orgName,
  memberCount,
}: {
  organizationId: string;
  orgName: string;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [purgeUsers, setPurgeUsers] = useState(true);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const matches = sameName(typed, orgName);

  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-2">Байгууллагыг бүх өгөгдөлтэй нь бүрмөсөн устгах.</p>
        <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>Бүрмөсөн устгах…</button>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="notice notice-danger">
        <strong>«{orgName}» бүрмөсөн устна:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Бүх журнал, касс, АР/АП, бараа, ҮХ, цалин, POS бичилт</li>
          <li>Багцын мөр, QPay төлбөрийн түүх, аудитын мөр, API token</li>
          <li>{memberCount} гишүүний эрх (гишүүнчлэл)</li>
        </ul>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={purgeUsers}
          onChange={(e) => setPurgeUsers(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--ea-primary)]"
        />
        <span>
          Гишүүдийн хэрэглэгчийн бүртгэлийг ч устгах — <span className="text-text-3">зөвхөн өөр байгууллагад гишүүн БИШ (өнчин болсон) хэрэглэгчид; бусад нь хэвээр</span>
        </span>
      </label>
      <label className="block">
        <span className="label">Баталгаажуулахын тулд нэрийг яг бичнэ: <span className="font-medium">{orgName}</span></span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={orgName} autoFocus />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-danger"
          disabled={pending || !matches}
          onClick={() =>
            start(async () => {
              const r = await deleteSaasOrganizationAction(organizationId, typed, purgeUsers);
              setResult(r);
              if (r.ok) router.push("/subscriptions?deleted=" + encodeURIComponent(orgName));
            })
          }
        >
          {pending ? "Устгаж байна…" : "Тийм, бүрмөсөн устга"}
        </button>
        <button className="btn btn-ghost" disabled={pending} onClick={() => { setOpen(false); setTyped(""); setResult(null); }}>Болих</button>
      </div>
      <Notice result={result} />
    </div>
  );
}
