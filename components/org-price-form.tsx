"use client";

import type { ColDef } from "ag-grid-community";
import { useActionState, useState } from "react";

import { DataGrid } from "@/components/datagrid/data-grid";

import { saveOrgPriceAction } from "@/lib/actions";
import {
  SAAS_PLAN_LABELS,
  byOrgName,
  rowsWithSpecialPrice,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";
import { fmtMnt } from "./ui";

import { Field, Notice } from "./forms";

const priceLabel = (value: number | null) => (value === null ? "хэлэлцээрээр" : fmtMnt(value));

/**
 * Байгууллагын ТУСГАЙ ҮНЭ — багцын үнийг дарна.
 * Жагсаалт нь зөвхөн тусгай үнэ ТОГТООСОН байгууллагуудыг харуулна; формоос
 * дурын байгууллагад нэмж, хоосон утгаар цэвэрлэнэ.
 */
export function OrgPriceSection({ rows }: { rows: SaasSubscriptionRow[] }) {
  const [result, action, pending] = useActionState(saveOrgPriceAction, null);
  const special = rowsWithSpecialPrice(rows);
  const sorted = [...rows].sort(byOrgName);
  const [selected, setSelected] = useState(sorted[0]?.organizationId ?? "");
  const current = sorted.find((row) => row.organizationId === selected);

  return (
    <div className="space-y-5">
      {special.length === 0 ? (
        <p className="text-sm text-text-3">
          Тусгай үнэтэй байгууллага алга — бүгд багцынхаа үнээр тооцогдож байна.
        </p>
      ) : (
        <DataGrid
          rows={special}
          columns={specialColumns(pending, setSelected)}
          getRowId={(row) => row.organizationId}
          rowHref={(row) => `/subscriptions/${row.organizationId}`}
          ariaLabel="Тусгай үнэтэй байгууллагууд"
          card={(row) => ({
            title: row.orgName,
            subtitle: SAAS_PLAN_LABELS[row.planId] ?? row.planId,
            corner: <span className="font-medium text-text-1">{priceLabel(row.pricePerSeatOverrideMnt)}</span>,
            meta: `суудал ${row.seats ?? "багцаар"} · сарын дүн ${row.monthlyAmountMnt === null ? "—" : fmtMnt(row.monthlyAmountMnt)}`,
            actions: (
              <button type="button" className="btn btn-sm" disabled={pending} onClick={() => setSelected(row.organizationId)}>
                Формд сонгох
              </button>
            ),
          })}
        />
      )}

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Байгууллага *" className="lg:col-span-2">
            <select
              name="organization_id"
              className="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {sorted.map((row) => (
                <option key={row.organizationId} value={row.organizationId}>
                  {row.orgName} · {SAAS_PLAN_LABELS[row.planId] ?? row.planId}
                  {row.pricePerSeatOverrideMnt === null ? "" : " · тусгай үнэтэй"}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Тусгай үнэ (₮ / суудал / сар)"
            hint={
              current
                ? `Хоосон = багцын үнэ дагана · одоо ${priceLabel(current.pricePerSeatMnt)}${
                    current.pricePerSeatOverrideMnt === null ? " (багцынх)" : " (тусгай)"
                  }`
                : "Хоосон = багцын үнэ дагана"
            }
          >
            <input
              key={selected}
              name="org_price"
              className="input"
              inputMode="numeric"
              placeholder="багцын үнэ"
              defaultValue={current?.pricePerSeatOverrideMnt ?? ""}
            />
          </Field>
        </div>
        <Notice result={result} />
        <button className="btn btn-primary" type="submit" disabled={pending || !selected}>
          {pending ? "Хадгалж байна…" : "Тусгай үнэ хадгалах"}
        </button>
      </form>
    </div>
  );
}

function specialColumns(pending: boolean, select: (id: string) => void): ColDef<SaasSubscriptionRow>[] {
  return [
    { headerName: "Байгууллага", field: "orgName", minWidth: 200, flex: 2, cellClass: "font-medium" },
    { headerName: "Багц", field: "planId", minWidth: 120, valueFormatter: ({ value }) => SAAS_PLAN_LABELS[value as SaasSubscriptionRow["planId"]] ?? value },
    { headerName: "Суудал", field: "seats", minWidth: 100, valueFormatter: ({ value }) => (value === null ? "багцаар" : String(value)) },
    { headerName: "Тусгай үнэ", field: "pricePerSeatOverrideMnt", minWidth: 130, type: "rightAligned", valueFormatter: ({ value }) => priceLabel(value) },
    { headerName: "Сарын дүн", field: "monthlyAmountMnt", minWidth: 130, type: "rightAligned", valueFormatter: ({ value }) => (value === null ? "—" : fmtMnt(value)) },
    {
      headerName: "",
      colId: "actions",
      sortable: false,
      resizable: false,
      minWidth: 140,
      maxWidth: 150,
      cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
        data ? (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => select(data.organizationId)}>
            Формд сонгох
          </button>
        ) : null,
    },
  ];
}
