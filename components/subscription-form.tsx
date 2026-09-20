"use client";

import { useActionState, useState } from "react";

import { saveSubscription } from "@/lib/actions";
import {
  formatOverrides,
  SAAS_ASSIGNABLE_PLANS,
  SAAS_PLAN_LABELS,
  SAAS_STATUS_LABELS,
  SAAS_STATUSES,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";

import { Field, Notice } from "./forms";

export function SubscriptionForm({ row }: { row: SaasSubscriptionRow }) {
  const [result, action, pending] = useActionState(saveSubscription, null);
  const [status, setStatus] = useState(row.status);
  const [overrides, setOverrides] = useState(formatOverrides(row.overrides));
  let overridesBad = false;
  if (overrides.trim()) {
    try {
      JSON.parse(overrides);
    } catch {
      overridesBad = true;
    }
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organization_id" value={row.organizationId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Багц *" hint="«Тусдаа сервис» нь лицензээр — SaaS-д оноохгүй">
          <select name="plan_id" className="select" defaultValue={SAAS_ASSIGNABLE_PLANS.includes(row.planId) ? row.planId : "standard"}>
            {SAAS_ASSIGNABLE_PLANS.map((plan) => (
              <option key={plan} value={plan}>{SAAS_PLAN_LABELS[plan]}</option>
            ))}
          </select>
        </Field>
        <Field label="Статус *" hint="Идэвхтэй = бичих эрх нээлттэй; бусад нь хугацаа/шалтгаанаар хаагдана">
          <select name="status" className="select" value={status} onChange={(e) => setStatus(e.target.value as SaasSubscriptionRow["status"])}>
            {SAAS_STATUSES.map((value) => (
              <option key={value} value={value}>{SAAS_STATUS_LABELS[value]}</option>
            ))}
          </select>
        </Field>
        <Field label="Суудал (төлсөн)" hint={`Хоосон = багцын default · одоо ${row.seatsUsed} ашиглаж байна`}>
          <input name="seats" className="input" inputMode="numeric" pattern="[0-9]*" defaultValue={row.seats ?? ""} placeholder="default" />
        </Field>
        <Field label={status === "trialing" ? "Trial дуусах *" : "Trial дуусах"} hint="Туршилт статуст заавал">
          <input name="trial_ends_at" className="input" type="date" defaultValue={row.trialEndsAt ?? ""} required={status === "trialing"} />
        </Field>
        <Field label="Төлбөрийн үе дуусах" hint="Хоцорсон бол энэ огнооноос 14 хоног grace">
          <input name="current_period_end" className="input" type="date" defaultValue={row.currentPeriodEnd ?? ""} />
        </Field>
        <Field
          label="Тусгай үнэ (₮ / суудал / сар)"
          hint={`Хоосон = багцын үнэ дагана${
            row.pricePerSeatMnt === null ? "" : ` (одоо ${row.pricePerSeatMnt.toLocaleString("en-US")}₮)`
          }`}
        >
          <input
            name="price_per_seat"
            className="input"
            inputMode="numeric"
            placeholder="багцын үнэ"
            defaultValue={row.pricePerSeatOverrideMnt === null ? "" : String(row.pricePerSeatOverrideMnt)}
          />
        </Field>
        <Field label="Тэмдэглэл" hint="Дотоод — гэрээний дугаар, төлбөрийн лавлагаа г.м.">
          <input name="note" className="input" defaultValue={row.note ?? ""} maxLength={500} />
        </Field>
      </div>
      <Field label="overrides (JSON)" hint='Багцаас ялгаатай хэсэг л: {"features":{"api.rest":true},"limits":{"seats":5}} · хоосон = багцын дагуу'>
        <textarea
          name="overrides"
          className="textarea mono"
          rows={4}
          value={overrides}
          aria-invalid={overridesBad || undefined}
          onChange={(e) => setOverrides(e.target.value)}
        />
      </Field>
      <Notice result={result} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending || overridesBad}>
          {pending ? "Хадгалж байна…" : "Хадгалах"}
        </button>
        {overridesBad ? <span className="text-xs text-danger">overrides JSON буруу</span> : <span className="text-xs text-text-3">Апп-д тэр даруй үйлчилнэ.</span>}
      </div>
    </form>
  );
}
