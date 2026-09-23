"use client";

import { useActionState, useRef, useState } from "react";

import { saveSubscription } from "@/lib/actions";
import {
  formatOverrides,
  overrideFeatureState,
  setOverrideFeature,
  SAAS_ASSIGNABLE_PLANS,
  SAAS_PLAN_LABELS,
  SAAS_STATUS_LABELS,
  SAAS_STATUSES,
  SUBSCRIPTION_PRESETS,
  presetOverridesJson,
  type SaasSubscriptionRow,
  type SubscriptionPreset,
} from "@/lib/saas-subscriptions";

import { Field, Notice } from "./forms";

export function SubscriptionForm({ row }: { row: SaasSubscriptionRow }) {
  const [result, action, pending] = useActionState(saveSubscription, null);
  const [status, setStatus] = useState(row.status);
  const [overrides, setOverrides] = useState(formatOverrides(row.overrides));
  const formRef = useRef<HTMLFormElement>(null);
  const [applied, setApplied] = useState<string | null>(null);

  // Preset нь ЗӨВХӨН формыг бөглөнө — хадгалахыг хэрэглэгч өөрөө дарна
  // (санамсаргүй бичилтээс сэргийлж, өмнө нь утгыг нь харж засах боломжтой).
  const applyPreset = (preset: SubscriptionPreset) => {
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = value;
    };
    set("plan_id", preset.planId);
    set("seats", String(preset.seats));
    set("current_period_end", preset.currentPeriodEnd);
    if (preset.note) set("note", preset.note);
    setStatus(preset.status);
    setOverrides(presetOverridesJson(preset));
    setApplied(preset.key);
  };
  let overridesBad = false;
  if (overrides.trim()) {
    try {
      JSON.parse(overrides);
    } catch {
      overridesBad = true;
    }
  }
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="organization_id" value={row.organizationId} />
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="mb-2 text-xs font-medium text-text-2">
          Бэлэн тохиргоо
          <span className="ml-2 font-normal text-text-3">
            — формыг бөглөнө, хадгалахыг та дарна
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUBSCRIPTION_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={applied === preset.key ? "btn btn-primary btn-sm" : "btn btn-sm"}
              title={preset.hint}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-3">
          «Нягтлан бодогч» тохиргоо нь олон компани нээнэ. Тухайн хүн шинэ компани
          үүсгэхэд багц нь автоматаар өвлөгдөнө (үнэ 0₮) — компани бүрд гараар мөр
          үүсгэх шаардлагагүй.
        </p>
      </div>
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
      <Field
        label="Мэдлэгийн сан (IFRS, татвар, цалин — AI/MCP)"
        hint="Аль ч багцад default OFF — энд асаахад л энэ байгууллагын AI чат, MCP-д мэдлэгийн сан нээгдэнэ (core: docs/knowledge/00-proposal.md D2). Доорх overrides JSON-д features.knowledge болж бичигдэнэ."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overrideFeatureState(overrides, "knowledge") === true}
            disabled={overridesBad}
            onChange={(e) =>
              setOverrides(setOverrideFeature(overrides, "knowledge", e.target.checked ? true : null))
            }
          />
          {overrideFeatureState(overrides, "knowledge") === true ? "Нээлттэй" : "Хаалттай (багцын дагуу)"}
        </label>
      </Field>
      <Field label="overrides (JSON)" hint='Багцаас ялгаатай хэсэг л: {"features":{"api.rest":true,"knowledge":true},"limits":{"seats":5}} · хоосон = багцын дагуу'>
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
