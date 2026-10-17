"use client";

// Буцаагдахгүй үйлдлийн баталгаажуулалт — нэр / кодыг ЯГ бичүүлнэ (харилцагч устгах,
// SaaS байгууллага устгах, гүйлгээ цэвэрлэх). Нэг хэв маяг: товч → анхааруулга → бичих → батлах.
import { useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/lib/actions";

import { Notice } from "./notice";

export function TypedConfirmZone({
  intro,
  openLabel,
  tone = "danger",
  heading,
  items,
  children,
  expected,
  expectedLabel,
  mono = false,
  matches = (typed) => typed.trim() === expected,
  submitLabel,
  pendingLabel,
  onConfirm,
  onDone,
}: {
  /** Хаалттай үеийн нэг өгүүлбэр. */
  intro: string;
  openLabel: string;
  tone?: "danger" | "warning";
  heading: ReactNode;
  items: ReactNode[];
  /** Жагсаалтын доорх нэмэлт (анхааруулга, сонголт). */
  children?: ReactNode;
  expected: string;
  /** «нэрийг» / «кодыг». */
  expectedLabel: string;
  mono?: boolean;
  matches?: (typed: string) => boolean;
  submitLabel: string;
  pendingLabel: string;
  onConfirm: (typed: string) => Promise<ActionResult>;
  /** Үр дүнгийн дараа — `close()` дуудвал хэсэг хаагдана. */
  onDone?: (result: ActionResult, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const close = () => {
    setOpen(false);
    setTyped("");
  };

  if (!open)
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">{intro}</p>
          <button className="btn btn-sm btn-danger" onClick={() => { setResult(null); setOpen(true); }}>{openLabel}</button>
        </div>
        <Notice result={result} />
      </div>
    );
  return (
    <div className="space-y-3">
      <div className={`notice notice-${tone}`}>
        <strong>{heading}</strong>
        <ul className="mt-1 list-disc pl-5">
          {items.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
      {children}
      <label className="block">
        <span className="label">
          Баталгаажуулахын тулд {expectedLabel} яг бичнэ: <span className={mono ? "mono" : "font-medium"}>{expected}</span>
        </span>
        <input className={mono ? "input mono" : "input"} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={expected} autoFocus />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-danger"
          disabled={pending || !matches(typed)}
          onClick={() =>
            start(async () => {
              const r = await onConfirm(typed);
              setResult(r);
              onDone?.(r, close);
            })
          }
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        <button className="btn btn-ghost" disabled={pending} onClick={() => { close(); setResult(null); }}>Болих</button>
      </div>
      <Notice result={result} />
    </div>
  );
}
