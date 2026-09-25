"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteSaasOrganizationAction, type ActionResult } from "@/lib/actions";

import { Notice } from "./forms";

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
  const matches = typed.trim().toLowerCase().replace(/\s+/g, " ") === orgName.trim().toLowerCase().replace(/\s+/g, " ");

  if (!open)
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-2">
          Байгууллагын бүх бичилт, харилцагч, бараа, тохиргоо, багцын мөр, төлбөрийн түүх core сервисээс устна.
          Буцаах боломжгүй — туршилтын эсвэл гэрээ дууссан байгууллагад л.
        </p>
        <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>Байгууллагыг бүрмөсөн устгах…</button>
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
