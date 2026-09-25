"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate, fmtMnt } from "@/components/ui";
import {
  BILLING_PAYMENT_STATUS_BADGE,
  BILLING_PAYMENT_STATUS_LABELS,
  describePaymentTerm,
  paidAmountOf,
  type SaasBillingPayment,
} from "@/lib/saas-billing";
import { SAAS_PLAN_LABELS, type SaasPlanId } from "@/lib/saas-subscriptions";

const href = (row: SaasBillingPayment) => `/subscriptions/${row.organizationId}`;
const planLabel = (planId: string) => SAAS_PLAN_LABELS[planId as SaasPlanId] ?? planId;

function StatusBadge({ row }: { row: SaasBillingPayment }) {
  return (
    <span className={`badge ${BILLING_PAYMENT_STATUS_BADGE[row.status] ?? "badge-muted"}`} title={row.lastError ?? undefined}>
      {BILLING_PAYMENT_STATUS_LABELS[row.status] ?? row.status}
    </span>
  );
}

function columns(showOrg: boolean): ColDef<SaasBillingPayment>[] {
  const list: ColDef<SaasBillingPayment>[] = [
    {
      headerName: "Огноо",
      field: "createdAt",
      minWidth: 140,
      sort: "desc",
      valueFormatter: ({ value }) => fmtDate(value as string),
      tooltipValueGetter: ({ data }) => (data?.paidAt ? `Төлсөн: ${fmtDate(data.paidAt)}` : null),
    },
  ];
  if (showOrg)
    list.push({
      headerName: "Байгууллага",
      field: "orgName",
      minWidth: 180,
      flex: 2,
      cellClass: "cell-stack",
      cellRenderer: ({ data }: { data?: SaasBillingPayment }) =>
        data ? (
          <>
            <Link href={href(data)} className="truncate font-medium hover:underline">{data.orgName}</Link>
            <span className="truncate text-text-3">{data.payerEmail ?? "—"}</span>
          </>
        ) : null,
    });
  list.push(
    { headerName: "Төлөв", field: "status", minWidth: 130, cellRenderer: ({ data }: { data?: SaasBillingPayment }) => (data ? <StatusBadge row={data} /> : null) },
    {
      headerName: "Багц",
      field: "planId",
      minWidth: 150,
      flex: 1,
      cellClass: "cell-stack",
      cellRenderer: ({ data }: { data?: SaasBillingPayment }) =>
        data ? (
          <>
            <span className="truncate">{planLabel(data.planId)}</span>
            <span className="text-xs text-text-3">{describePaymentTerm(data)}</span>
          </>
        ) : null,
    },
    {
      headerName: "Дүн",
      colId: "amount",
      minWidth: 110,
      type: "rightAligned",
      valueGetter: ({ data }) => (!data ? 0 : data.status === "paid" ? paidAmountOf(data) : data.amount),
      valueFormatter: ({ value }) => fmtMnt(value as number),
    },
    {
      headerName: "Хүчинтэй хүртэл",
      field: "periodEnd",
      minWidth: 120,
      valueFormatter: ({ value }) => (value ? fmtDate(value as string, false) : "—"),
    },
    {
      headerName: "QPay нэхэмжлэх",
      field: "qpayInvoiceId",
      minWidth: 150,
      cellClass: "mono",
      tooltipValueGetter: ({ data }) => data?.lastError ?? data?.qpayInvoiceId ?? null,
      valueFormatter: ({ value }) => (value as string | null) ?? "—",
    }
  );
  return list;
}

export function BillingPaymentsGrid({ rows, showOrg = true }: { rows: SaasBillingPayment[]; showOrg?: boolean }) {
  return (
    <DataGrid
      rows={rows}
      columns={columns(showOrg)}
      getRowId={(row) => row.id}
      rowHref={showOrg ? href : undefined}
      rowHeight={54}
      ariaLabel="QPay төлбөрүүд"
      card={(row) => ({
        title: showOrg ? row.orgName : `${planLabel(row.planId)} · ${describePaymentTerm(row)}`,
        subtitle: showOrg ? `${planLabel(row.planId)} · ${describePaymentTerm(row)}` : fmtDate(row.createdAt),
        corner: <span className="font-medium text-text-2">{fmtMnt(row.status === "paid" ? paidAmountOf(row) : row.amount)}</span>,
        badges: <StatusBadge row={row} />,
        meta: (
          <>
            {showOrg ? <>{fmtDate(row.createdAt)} · </> : null}
            {row.periodEnd ? <>хүчинтэй {fmtDate(row.periodEnd, false)} хүртэл</> : row.lastError ?? "—"}
          </>
        ),
      })}
    />
  );
}
