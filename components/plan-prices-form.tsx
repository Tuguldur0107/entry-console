"use client";

import { useActionState } from "react";

import { savePlanPricesAction } from "@/lib/actions";
import {
  SAAS_PLAN_LABELS,
  SAAS_PRICEABLE_PLANS,
  type SaasPlanPrices,
} from "@/lib/saas-subscriptions";

import { Field, Notice } from "./forms";

const HINTS: Partial<Record<string, string>> = {
  trial: "Туршилтын үе — ихэвчлэн 0₮",
  standard: "Нэг компани, үндсэн модулиуд",
  platform: "Олон компани, REST API, custom/ өргөтгөл",
  enterprise: "Хэлэлцээрээр — хоосон үлдээж харилцагч бүрд тусгай үнэ тогтоож болно",
  dedicated: "Эх код авсан, тусдаа сервистэй харилцагч (лицензээр)",
};

export function PlanPricesForm({ prices, defaults }: { prices: SaasPlanPrices; defaults: SaasPlanPrices }) {
  const [result, action, pending] = useActionState(savePlanPricesAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SAAS_PRICEABLE_PLANS.map((planId) => {
          const current = prices[planId];
          const fallback = defaults[planId];
          return (
            <Field
              key={planId}
              label={`${SAAS_PLAN_LABELS[planId]} — ₮ / суудал / сар`}
              hint={`${HINTS[planId] ?? ""} · кодын default: ${
                fallback === null || fallback === undefined ? "хэлэлцээрээр" : `${fallback.toLocaleString("en-US")}₮`
              }`}
            >
              <input
                name={`price_${planId}`}
                className="input"
                inputMode="numeric"
                placeholder="хэлэлцээрээр (хоосон)"
                defaultValue={current === null || current === undefined ? "" : String(current)}
              />
            </Field>
          );
        })}
      </div>
      <Notice result={result} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Хадгалж байна…" : "Үнэ хадгалах"}
        </button>
        <span className="text-xs text-text-3">Бүх харилцагчид тэр даруй үйлчилнэ.</span>
      </div>
    </form>
  );
}
