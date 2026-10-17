"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef } from "react";

import { chatAction, type ActionResult } from "@/lib/actions";
import { CHAT_BODY_MAX, type ChatAction } from "@/lib/saas-chat";

import { askConfirm } from "@/components/ui/confirm-dialog";
import { Notice } from "./forms";

/** Хувийн ярианд хариу / нийтийн өрөөнд «Entry баг»-аар нийтлэх. Амжилттай бол талбар цэвэрлэгдэнэ. */
export function ChatComposer({
  mode,
  threadId,
  replyTo,
  cancelReplyHref,
  disabled,
}: {
  mode: "reply" | "room_post";
  threadId?: string;
  replyTo?: { id: string; name: string } | null;
  cancelReplyHref?: string;
  disabled?: boolean;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(chatAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const replyingTo = replyTo?.id;
  useEffect(() => {
    if (!result?.ok) return;
    formRef.current?.reset();
    // Хариулт нийтлэгдсэн — `?reply=` арилгана, эс бөгөөс дараагийн нийтлэл ч тэр мессежийн хариу болно.
    if (replyingTo && cancelReplyHref) router.replace(cancelReplyHref, { scroll: false });
  }, [result, replyingTo, cancelReplyHref, router]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="action" value={mode} />
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      {replyTo ? <input type="hidden" name="replyToId" value={replyTo.id} /> : null}
      {replyTo ? (
        <div className="flex items-center justify-between gap-2 text-xs text-text-3">
          <span>«{replyTo.name}»-д хариулж байна</span>
          {cancelReplyHref ? <Link href={cancelReplyHref} className="hover:underline">Болих</Link> : null}
        </div>
      ) : null}
      <textarea
        name="body"
        className="textarea min-h-24"
        maxLength={CHAT_BODY_MAX}
        required
        disabled={disabled || pending}
        placeholder={mode === "reply" ? "Хариу бичих…" : "Нийтийн өрөөнд «Entry баг»-аар бичих…"}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-4">Ctrl/⌘ + Enter</span>
        <button className="btn btn-primary btn-sm" type="submit" disabled={disabled || pending}>
          {pending ? "Илгээж байна…" : mode === "reply" ? "Хариулах" : "Нийтлэх"}
        </button>
      </div>
      {result && !result.ok ? <Notice result={result} /> : null}
    </form>
  );
}

/** Нэг товчтой үйлдэл (нуух, хаах, хориглох…) — хориглох нь баталгаажуулалттай. */
export function ChatActionButton({
  action,
  field,
  value,
  label,
  danger,
  subtle,
  confirmText,
}: {
  action: ChatAction;
  field: "threadId" | "messageId" | "visitorId";
  value: string;
  label: string;
  danger?: boolean;
  /** Мессеж доторх товч — улаан дэвсгэргүй, зөвхөн текстийн өнгө. */
  subtle?: boolean;
  confirmText?: string;
}) {
  const [result, run, pending] = useActionState<ActionResult | null, FormData>(chatAction, null);
  return (
    <form
      action={run}
      className="inline-flex items-center gap-2"
      onSubmit={async (event) => {
        if (!confirmText) return;
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (!(await askConfirm(confirmText, { confirmText: label, danger }))) return;
        startTransition(() => run(data));
      }}
    >
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name={field} value={value} />
      <button type="submit" className={`btn btn-sm ${danger && !subtle ? "btn-danger" : "btn-ghost"} ${danger && subtle ? "text-danger" : ""}`} disabled={pending}>
        {pending ? "…" : label}
      </button>
      {result && !result.ok ? <span className="text-xs text-danger" role="alert">{result.error}</span> : null}
    </form>
  );
}
