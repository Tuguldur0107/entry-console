"use client";

import { useActionState, useState, useTransition } from "react";

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
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Багц</th>
            <th>Өнөөдрийн үнэ</th>
            <th>Мөрдөж эхэлсэн</th>
            <th>Дуусах</th>
            <th>Эх сурвалж</th>
          </tr>
        </thead>
        <tbody>
          {SAAS_PRICEABLE_PLANS.map((planId) => {
            const active = currentPeriod(periods, planId, today);
            return (
              <tr key={planId}>
                <td className="font-medium">{SAAS_PLAN_LABELS[planId]}</td>
                <td>{priceLabel(prices[planId])}</td>
                <td className="mono text-text-2">{active?.effectiveFrom ?? "—"}</td>
                <td className="mono text-text-2">{active ? active.effectiveTo ?? "хугацаагүй" : "—"}</td>
                <td className="text-text-3">
                  {active ? "тохируулсан үнэ" : `кодын default (${priceLabel(defaults[planId])})`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  return (
    <div className="space-y-4">
      <Notice result={result} />
      {groups.map((group) => (
        <PlanGroup
          key={group.planId}
          planId={group.planId}
          periods={group.periods}
          today={today}
          pending={pending}
          onDelete={(id) =>
            startTransition(async () => {
              if (!confirm("Энэ үнийн үеийг устгах уу?")) return;
              setResult(await deletePlanPriceAction(id));
            })
          }
        />
      ))}
    </div>
  );
}

function PlanGroup({
  planId,
  periods,
  today,
  pending,
  onDelete,
}: {
  planId: SaasPlanId;
  periods: SaasPlanPricePeriod[];
  today: string;
  pending: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="card-title mb-2">{SAAS_PLAN_LABELS[planId]}</h3>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Мөрдөх хугацаа</th>
              <th>Үнэ</th>
              <th>Төлөв</th>
              <th>Тэмдэглэл</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const status = periodStatus(period, today);
              return (
                <tr key={period.id}>
                  <td className="mono text-text-2">
                    {period.effectiveFrom} … {period.effectiveTo ?? "хугацаагүй"}
                  </td>
                  <td>{priceLabel(period.pricePerSeatMnt)}</td>
                  <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                  <td className="text-text-3">{period.note ?? "—"}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={pending}
                      onClick={() => onDelete(period.id)}
                    >
                      Устгах
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
