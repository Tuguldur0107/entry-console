"use client";

import { useActionState, useState } from "react";

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
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Байгууллага</th>
                <th>Багц</th>
                <th>Суудал</th>
                <th>Тусгай үнэ</th>
                <th>Сарын дүн</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {special.map((row) => (
                <tr key={row.organizationId}>
                  <td className="font-medium">{row.orgName}</td>
                  <td>{SAAS_PLAN_LABELS[row.planId] ?? row.planId}</td>
                  <td>{row.seats === null ? "default" : row.seats}</td>
                  <td>{priceLabel(row.pricePerSeatOverrideMnt)}</td>
                  <td>{row.monthlyAmountMnt === null ? "—" : fmtMnt(row.monthlyAmountMnt)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() => setSelected(row.organizationId)}
                    >
                      Формд сонгох
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
