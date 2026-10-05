"use client";

// Харилцагчдаас сонгоод и-мэйл илгээх. Илгээлтийг core хийнэ (хаягийг DB-ээс олж,
// татгалзсан хэрэглэгчийг алгасаж, мэйл бүрт татгалзах линк нэмнэ). Бичих цонх бүр
// нэг idempotencyKey-тэй — давхар дарвал дахин илгээгдэхгүй.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { TrialContactsGrid } from "@/components/grids/trial-contacts-grid";
import { sendCampaignAction, sendTestEmailAction, type ActionResult } from "@/lib/actions";
import {
  CAMPAIGN_MAX_RECIPIENTS,
  composeErrors,
  isUnsubscribed,
  previewText,
  sendableIds,
  type SaasTrialContact,
} from "@/lib/saas-emails";
import { Field, Notice } from "./forms";

const newKey = () => `console-${crypto.randomUUID()}`;
/** Модулийн түвшинд — grid-ийн rowSelection тогтвортой үлдэнэ (render бүрд шинэ функц биш). */
const selectable = (row: SaasTrialContact) => !isUnsubscribed(row);

export function EmailComposer({
  contacts,
  visible,
  defaultTestEmail,
  senderReady,
}: {
  /** Бүх харилцагч (сонголт шүүлтүүр солигдоход хадгалагдана). */
  contacts: SaasTrialContact[];
  /** Шүүлтүүр/хайлтын дараах мөрүүд. */
  visible: SaasTrialContact[];
  defaultTestEmail: string | null;
  senderReady: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState(defaultTestEmail ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [result, setResult] = useState<(ActionResult & { campaignId?: string }) | null>(null);
  const [pending, startTransition] = useTransition();

  const recipients = useMemo(() => sendableIds(contacts, selected), [contacts, selected]);
  const errors = composeErrors({ subject, body, recipients: recipients.length });
  const sample = contacts.find((c) => c.organizationId === recipients[0]) ?? visible[0] ?? null;

  const selectVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of visible) if (selectable(row)) next.add(row.organizationId);
      return next;
    });

  const sendTest = () =>
    startTransition(async () => {
      setResult(await sendTestEmailAction({ to: testTo, organizationId: recipients[0] ?? null, subject, body }));
    });

  const send = () => {
    if (!window.confirm(`${recipients.length} хүнд «${subject.trim()}» илгээх үү? Буцаах боломжгүй.`)) return;
    startTransition(async () => {
      const outcome = await sendCampaignAction({ organizationIds: recipients, subject, body, idempotencyKey });
      setResult(outcome);
      if (outcome.ok) {
        setSelected(new Set());
        setIdempotencyKey(newKey());
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm" onClick={selectVisible} disabled={visible.length === 0}>
          Харагдаж буйг сонгох ({visible.filter(selectable).length})
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
          Цэвэрлэх
        </button>
        <span className="text-sm text-text-3">
          Сонгосон: <strong className="text-text-1">{recipients.length}</strong>
          {recipients.length > CAMPAIGN_MAX_RECIPIENTS ? ` (дээд тал нь ${CAMPAIGN_MAX_RECIPIENTS})` : ""}
        </span>
      </div>

      <TrialContactsGrid rows={visible} selection={{ selected, onChange: setSelected, isSelectable: selectable }} />

      <div className="card space-y-4 p-4">
        <Field label="Гарчиг">
          <input className="input" value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} />
        </Field>
        <Field label="Текст" hint="{{name}} — эзний нэр, {{company}} — байгууллага. Татгалзах линк автоматаар нэмэгдэнэ.">
          <textarea className="textarea" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        {subject.trim() || body.trim() ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium text-text-1">{previewText(subject, sample)}</p>
            <p className="mt-2 whitespace-pre-wrap text-text-2">{previewText(body, sample)}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Туршилтын хаяг" className="min-w-60 flex-1">
            <input className="input" type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
          </Field>
          <button
            type="button"
            className="btn"
            onClick={sendTest}
            disabled={pending || !senderReady || !testTo.trim() || !subject.trim() || !body.trim()}
          >
            Өөр рүүгээ турших
          </button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={pending || !senderReady || errors.length > 0}>
            {pending ? "…" : `${recipients.length} хүнд илгээх`}
          </button>
        </div>
        {errors.length > 0 && (subject || body || selected.size > 0) ? (
          <p className="hint">{errors.join(" · ")}</p>
        ) : null}
        <Notice result={result} />
        {result?.ok && result.campaignId ? (
          <Link href={`/emails/${result.campaignId}`} className="text-sm underline">
            Илгээлтийн дэлгэрэнгүй
          </Link>
        ) : null}
      </div>
    </div>
  );
}
