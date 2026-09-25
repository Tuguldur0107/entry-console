"use client";

// ДЭМЖЛЭГИЙН ХАНДАЛТ — харилцагчийн байгууллагад ТҮР орох линк үүсгэнэ.
//
// Апп дотор «супер админ» эрх БАЙХГҮЙ: линк нь 15 минут хүчинтэй, нэг Entry
// дансанд уягдаж, орсны дараа 1 цаг ажиллана. Орох/гарах бүр харилцагчийн
// аудитад бичигдэж, эзэн/админд нь и-мэйл очно.

import type { ColDef } from "ag-grid-community";
import { useActionState, useState } from "react";

import { DataGrid } from "@/components/datagrid/data-grid";

import { endSupportSessionAction, openSupportSessionAction } from "@/lib/actions";
import {
  SUPPORT_ROLE_LABELS,
  SUPPORT_STATE_BADGE,
  SUPPORT_STATE_LABELS,
  openSupportSessions,
  type SaasSupportSession,
} from "@/lib/saas-orgs";
import { Field, Notice } from "./forms";
import { fmtDate } from "./ui";

export function SupportAccessSection({
  organizationId,
  orgName,
  defaultEmail,
  sessions,
}: {
  organizationId: string;
  orgName: string;
  defaultEmail: string | null;
  sessions: SaasSupportSession[];
}) {
  const [result, action, pending] = useActionState(openSupportSessionAction, null);
  const [endResult, endAction, ending] = useActionState(endSupportSessionAction, null);
  const [role, setRole] = useState<"viewer" | "admin">("viewer");
  const open = openSupportSessions(sessions);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="organization_id" value={organizationId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Entry дансны и-мэйл *"
            hint="Линк ЭНЭ данстай хүнд уягдана — өөр хүн олсон ч ашиглаж чадахгүй."
          >
            <input
              name="support_email"
              type="email"
              className="input"
              placeholder="ta@example.com"
              defaultValue={defaultEmail ?? ""}
              required
            />
          </Field>
          <Field
            label="Хандалтын түвшин"
            hint={
              role === "admin"
                ? "Бичилт, тохиргоо нээгдэнэ. Байгууллага устгах / эзэмшил шилжүүлэх БОЛОМЖГҮЙ хэвээр."
                : "Аюулгүй сонголт — юу ч өөрчлөгдөхгүй."
            }
          >
            <select
              name="support_role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as "viewer" | "admin")}
            >
              <option value="viewer">{SUPPORT_ROLE_LABELS.viewer}</option>
              <option value="admin">{SUPPORT_ROLE_LABELS.admin}</option>
            </select>
          </Field>
        </div>
        <Field label="Шалтгаан" hint="Харилцагчийн аудитын мөрд ил гарна — тодорхой бич.">
          <input
            name="support_reason"
            className="input"
            placeholder="Жишээ: 2026-08 сар хаагдахгүй байгааг шалгах"
          />
        </Field>

        {role === "admin" ? (
          <p className="notice notice-warning">
            Админ түвшин нь <b>{orgName}</b>-ийн өгөгдөлд бичих эрх олгоно. Зөвхөн
            харилцагч хүсэлт гаргасан үед, хийх ажлаа тодорхой мэдэж байгаа бол
            сонгоно уу.
          </p>
        ) : null}

        <Notice result={result} />
        {result?.ok && result.url ? (
          <a
            className="btn btn-primary"
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {orgName} → нэвтрэх (шинэ цонхонд)
          </a>
        ) : (
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Линк үүсгэж байна…" : "Байгууллагад нэвтрэх линк үүсгэх"}
          </button>
        )}
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Хандалтын түүх {open.length > 0 ? `· ${open.length} нээлттэй` : ""}
        </h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-text-3">Энэ байгууллагад хандалт хийгдээгүй байна.</p>
        ) : (
          <DataGrid
            rows={sessions}
            columns={sessionColumns(organizationId, endAction, ending)}
            getRowId={(row) => row.id}
            ariaLabel="Хандалтын түүх"
            card={(row) => ({
              title: row.email ?? "—",
              subtitle: row.reason ?? "шалтгаангүй",
              corner: fmtDate(row.endsAt ?? row.expiresAt),
              badges: (
                <>
                  <span className={`badge ${SUPPORT_STATE_BADGE[row.state]}`}>{SUPPORT_STATE_LABELS[row.state]}</span>
                  <span className="badge badge-muted badge-plain">{SUPPORT_ROLE_LABELS[row.role]}</span>
                </>
              ),
              actions: canEnd(row) ? <EndButton row={row} organizationId={organizationId} action={endAction} disabled={ending} /> : null,
            })}
          />
        )}
        <Notice result={endResult} />
      </div>
    </div>
  );
}

const canEnd = (row: SaasSupportSession) => row.state === "active" || row.state === "pending";

function EndButton({ row, organizationId, action, disabled }: { row: SaasSupportSession; organizationId: string; action: (data: FormData) => void; disabled: boolean }) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="session_id" value={row.id} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <button className="btn btn-sm" type="submit" disabled={disabled}>
        Таслах
      </button>
    </form>
  );
}

function sessionColumns(organizationId: string, action: (data: FormData) => void, disabled: boolean): ColDef<SaasSupportSession>[] {
  return [
    {
      headerName: "Төлөв",
      field: "state",
      minWidth: 130,
      cellRenderer: ({ data }: { data?: SaasSupportSession }) =>
        data ? <span className={`badge ${SUPPORT_STATE_BADGE[data.state]}`}>{SUPPORT_STATE_LABELS[data.state]}</span> : null,
    },
    { headerName: "Хэн", field: "email", minWidth: 180, flex: 1.5, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
    { headerName: "Эрх", field: "role", minWidth: 140, valueFormatter: ({ value }) => SUPPORT_ROLE_LABELS[value as SaasSupportSession["role"]] ?? value },
    { headerName: "Шалтгаан", field: "reason", minWidth: 180, flex: 2, tooltipField: "reason", valueFormatter: ({ value }) => value ?? "—" },
    { headerName: "Орсон", field: "startedAt", minWidth: 140, valueFormatter: ({ value }) => (value ? fmtDate(value) : "—") },
    { headerName: "Дуусах", colId: "ends", minWidth: 140, valueGetter: ({ data }) => data?.endsAt ?? data?.expiresAt ?? "", valueFormatter: ({ value }) => fmtDate(value) },
    {
      headerName: "",
      colId: "actions",
      sortable: false,
      resizable: false,
      minWidth: 100,
      maxWidth: 110,
      cellRenderer: ({ data }: { data?: SaasSupportSession }) =>
        data && canEnd(data) ? <EndButton row={data} organizationId={organizationId} action={action} disabled={disabled} /> : null,
    },
  ];
}
