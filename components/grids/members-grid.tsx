"use client";

import type { ColDef } from "ag-grid-community";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { MEMBER_ROLE_LABELS, type SaasOrgMember } from "@/lib/saas-orgs";

const Verified = ({ ok }: { ok: boolean }) => (ok ? <span className="badge badge-success">Баталгаажсан</span> : <span className="badge badge-warning">Баталгаажаагүй</span>);

const COLUMNS: ColDef<SaasOrgMember>[] = [
  { headerName: "И-мэйл", field: "email", minWidth: 200, flex: 2, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Нэр", field: "name", minWidth: 140, flex: 1.5, valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Роль", field: "role", minWidth: 110, valueFormatter: ({ value }) => MEMBER_ROLE_LABELS[value as string] ?? value },
  { headerName: "И-мэйл", colId: "verified", minWidth: 140, valueGetter: ({ data }) => (data?.emailVerified ? 1 : 0), cellRenderer: ({ data }: { data?: SaasOrgMember }) => (data ? <Verified ok={data.emailVerified} /> : null) },
  { headerName: "Элссэн", field: "joinedAt", minWidth: 110, valueFormatter: ({ value }) => fmtDate(value, false) },
];

export function MembersGrid({ members }: { members: SaasOrgMember[] }) {
  return (
    <DataGrid
      rows={members}
      columns={COLUMNS}
      getRowId={(row) => row.userId}
      ariaLabel="Гишүүд"
      card={(row) => ({
        title: row.name ?? row.email ?? "—",
        subtitle: row.name ? row.email : null,
        corner: fmtDate(row.joinedAt, false),
        badges: (
          <>
            <span className="badge badge-muted badge-plain">{MEMBER_ROLE_LABELS[row.role] ?? row.role}</span>
            <Verified ok={row.emailVerified} />
          </>
        ),
      })}
    />
  );
}
