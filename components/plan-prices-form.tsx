"use client";

import type { ColDef } from "ag-grid-community";
import { useActionState, useState, useTransition } from "react";

import { DataGrid } from "@/components/datagrid/data-grid";

import { addPlanPriceAction, deletePlanPriceAction } from "@/lib/actions";
import type { ActionResult } from "@/lib/actions";
import {
  SAAS_PLAN_LABELS,
  SAAS_PRICEABLE_PLANS,
  currentPeriod,
  groupPeriodsByPlan,
  periodStatus,
  type SaasPlanId,
  type SaasPlanPricePeriod,
  type SaasPlanPrices,
} from "@/lib/saas-subscriptions";
import { fmtMnt } from "./ui";

import { Field, Notice } from "./forms";

const priceLabel = (value: number | null | undefined) =>
  value === null || value === undefined ? "хэлэлцээрээр" : fmtMnt(value);

/** Багц бүрийн ӨНӨӨДРИЙН үнэ — хаанаас ирснийг ил хэлнэ. */
export function CurrentPricesTable({
  periods,
  prices,
  defaults,
  today,
}: {
  periods: SaasPlanPricePeriod[];
  prices: SaasPlanPrices;
  defaults: SaasPlanPrices;
  today: string;
}) {
  const rows: CurrentPriceRow[] = SAAS_PRICEABLE_PLANS.map((planId) => {
    const active = currentPeriod(periods, planId, today);
    return {
      planId,
      price: prices[planId] ?? null,
      from: active?.effectiveFrom ?? null,
      to: active ? active.effectiveTo ?? "хугацаагүй" : null,
      source: active ? "тохируулсан үнэ" : `кодын default (${priceLabel(defaults[planId])})`,
    };
  });
  return (
    <DataGrid
      rows={rows}
      columns={CURRENT_COLUMNS}
      getRowId={(row) => row.planId}
      ariaLabel="Өнөөдрийн үнэ"
      card={(row) => ({
        title: SAAS_PLAN_LABELS[row.planId],
        corner: <span className="font-medium text-text-1">{priceLabel(row.price)}</span>,
        meta: `${row.from ? `${row.from} … ${row.to}` : "үе алга"} · ${row.source}`,
      })}
    />
  );
}

type CurrentPriceRow = { planId: SaasPlanId; price: number | null; from: string | null; to: string | null; source: string };

const CURRENT_COLUMNS: ColDef<CurrentPriceRow>[] = [
  { headerName: "Багц", field: "planId", minWidth: 180, flex: 2, cellClass: "font-medium", valueFormatter: ({ value }) => SAAS_PLAN_LABELS[value as SaasPlanId] ?? value },
  { headerName: "Өнөөдрийн үнэ", field: "price", minWidth: 140, type: "rightAligned", valueFormatter: ({ value }) => priceLabel(value) },
  { headerName: "Мөрдөж эхэлсэн", field: "from", minWidth: 130, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Дуусах", field: "to", minWidth: 120, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Эх сурвалж", field: "source", minWidth: 200, flex: 2 },
];

/** Шинэ үнийн үе — багц, үнэ, мөрдөх хугацаа. */
export function AddPlanPriceForm({ today }: { today: string }) {
  const [result, action, pending] = useActionState(addPlanPriceAction, null);
  const [openEnded, setOpenEnded] = useState(true);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Багц *">
          <select name="plan_id" className="select" defaultValue="standard">
            {SAAS_PRICEABLE_PLANS.map((planId) => (
              <option key={planId} value={planId}>{SAAS_PLAN_LABELS[planId]}</option>
            ))}
          </select>
        </Field>
        <Field label="Үнэ (₮ / суудал / сар)" hint="Хоосон = хэлэлцээрээр · үнэгүй бол 0">
          <input name="price" className="input" inputMode="numeric" placeholder="хэлэлцээрээр" />
        </Field>
        <Field label="Мөрдөж эхлэх *" hint="Энэ өдрөөс эхлэн үйлчилнэ (ирээдүйн огноо ч болно)">
          <input name="effective_from" className="input" type="date" defaultValue={today} required />
        </Field>
        <Field label="Дуусах" hint="Хоосон = хугацаагүй. Дараа шинэ үнэ нэмэхэд өмнөх нь автоматаар хаагдана">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={openEnded}
                onChange={(e) => setOpenEnded(e.target.checked)}
                className="h-4 w-4"
              />
              Хугацаагүй
            </label>
            {!openEnded && <input name="effective_to" className="input" type="date" />}
          </div>
        </Field>
        <Field label="Тэмдэглэл" className="lg:col-span-2">
          <input name="note" className="input" placeholder="ж: 2027 оны тарифын шинэчлэл" maxLength={200} />
        </Field>
      </div>
      <Notice result={result} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Нэмж байна…" : "Үнийн үе нэмэх"}
      </button>
    </form>
  );
}

/** Үнийн түүх — багцаар бүлэглэсэн, устгах боломжтой. */
export function PlanPriceHistory({
  periods,
  today,
}: {
  periods: SaasPlanPricePeriod[];
  today: string;
}) {
  const groups = groupPeriodsByPlan(periods);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (groups.length === 0)
    return <p className="text-sm text-text-3">Тохируулсан үнэ алга — бүх багц кодын default-аар ажиллаж байна.</p>;
  const rows = groups.flatMap((group) => group.periods);
  const remove = (period: SaasPlanPricePeriod) =>
    startTransition(async () => {
      const status = periodStatus(period, today);
      // Мөрдөж буй / дууссан үеийг устгавал ТЭР хугацааны сарын дүн кодын default-аар
      // дахин бодогдоно (түүх өөрчлөгдөнө) — зөвхөн буруу оруулсныг засахад.
      const warning =
        status.label === "Ирээдүйд"
          ? "Ирээдүйн энэ үнийн үеийг устгах уу?"
          : `«${status.label}» үеийг устгавал ${period.effectiveFrom}-с хойшхи сарын дүн өөр үнээр (эсвэл кодын default-аар) дахин бодогдоно — өнгөрсөн түүх өөрчлөгдөнө.\n\nЗөвхөн БУРУУ оруулсан үнийг засах бол устгана уу. Үнэ өөрчлөх бол шинэ үе нэмнэ. Устгах уу?`;
      if (!confirm(warning)) return;
      setResult(await deletePlanPriceAction(period.id));
    });
  return (
    <div className="space-y-3">
      <Notice result={result} />
      <DataGrid
        rows={rows}
        columns={historyColumns(today, pending, remove)}
        getRowId={(row) => row.id}
        ariaLabel="Үнийн түүх"
        card={(row) => {
          const status = periodStatus(row, today);
          return {
            title: SAAS_PLAN_LABELS[row.planId],
            subtitle: `${row.effectiveFrom} … ${row.effectiveTo ?? "хугацаагүй"}`,
            corner: <span className="font-medium text-text-1">{priceLabel(row.pricePerSeatMnt)}</span>,
            badges: <span className={`badge ${status.cls}`}>{status.label}</span>,
            meta: row.note,
            actions: (
              <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => remove(row)}>
                Устгах
              </button>
            ),
          };
        }}
      />
    </div>
  );
}

function historyColumns(today: string, pending: boolean, remove: (period: SaasPlanPricePeriod) => void): ColDef<SaasPlanPricePeriod>[] {
  return [
    { headerName: "Багц", field: "planId", minWidth: 160, flex: 1.5, cellClass: "font-medium", valueFormatter: ({ value }) => SAAS_PLAN_LABELS[value as SaasPlanId] ?? value },
    {
      headerName: "Мөрдөх хугацаа",
      field: "effectiveFrom",
      minWidth: 210,
      flex: 2,
      cellClass: "mono",
      valueFormatter: ({ data }) => (data ? `${data.effectiveFrom} … ${data.effectiveTo ?? "хугацаагүй"}` : ""),
    },
    { headerName: "Үнэ", field: "pricePerSeatMnt", minWidth: 120, type: "rightAligned", valueFormatter: ({ value }) => priceLabel(value) },
    {
      headerName: "Төлөв",
      colId: "status",
      minWidth: 120,
      valueGetter: ({ data }) => (data ? periodStatus(data, today).label : ""),
      cellRenderer: ({ data }: { data?: SaasPlanPricePeriod }) => {
        if (!data) return null;
        const status = periodStatus(data, today);
        return <span className={`badge ${status.cls}`}>{status.label}</span>;
      },
    },
    { headerName: "Тэмдэглэл", field: "note", minWidth: 160, flex: 2, valueFormatter: ({ value }) => value ?? "—" },
    {
      headerName: "",
      colId: "actions",
      sortable: false,
      resizable: false,
      minWidth: 100,
      maxWidth: 110,
      cellRenderer: ({ data }: { data?: SaasPlanPricePeriod }) =>
        data ? (
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => remove(data)}>
            Устгах
          </button>
        ) : null,
    },
  ];
}
