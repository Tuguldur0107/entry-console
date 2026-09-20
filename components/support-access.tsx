"use client";

// ДЭМЖЛЭГИЙН ХАНДАЛТ — харилцагчийн байгууллагад ТҮР орох линк үүсгэнэ.
//
// Апп дотор «супер админ» эрх БАЙХГҮЙ: линк нь 15 минут хүчинтэй, нэг Entry
// дансанд уягдаж, орсны дараа 1 цаг ажиллана. Орох/гарах бүр харилцагчийн
// аудитад бичигдэж, эзэн/админд нь и-мэйл очно.

import { useActionState, useState } from "react";

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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Төлөв</th>
                  <th>Хэн</th>
                  <th>Эрх</th>
                  <th>Шалтгаан</th>
                  <th>Орсон</th>
                  <th>Дуусах</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`badge ${SUPPORT_STATE_BADGE[row.state]}`}>
                        {SUPPORT_STATE_LABELS[row.state]}
                      </span>
                    </td>
                    <td className="mono">{row.email ?? "—"}</td>
                    <td>{SUPPORT_ROLE_LABELS[row.role]}</td>
                    <td className="text-text-3">{row.reason ?? "—"}</td>
                    <td>{row.startedAt ? fmtDate(row.startedAt) : "—"}</td>
                    <td>{fmtDate(row.endsAt ?? row.expiresAt)}</td>
                    <td className="text-right">
                      {row.state === "active" || row.state === "pending" ? (
                        <form action={endAction} className="inline">
                          <input type="hidden" name="session_id" value={row.id} />
                          <input type="hidden" name="organization_id" value={organizationId} />
                          <button className="btn btn-sm" type="submit" disabled={ending}>
                            Таслах
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Notice result={endResult} />
      </div>
    </div>
  );
}
