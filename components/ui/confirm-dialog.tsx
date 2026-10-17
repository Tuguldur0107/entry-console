"use client";

// Баталгаажуулах цонх — браузерын `confirm()`-ийн оронд (Entry-ийн загвартай, dark mode,
// Esc = болих). `askConfirm` нь Promise<boolean> буцаана; host layout-д НЭГ удаа mount
// хийгдэнэ. Host алга бол (тест г.м.) браузерын confirm руу унана.
// `confirm()` хуудсыг түгждэг байсан бол энэ түгжихгүй — ижил асуулт нээлттэй үед давхар
// даралт «үгүй» болно (үйлдэл 2 удаа ажиллахгүй). Аюултай үйлдэлд анхдагч товч «Болих».

import { useEffect, useRef, useState } from "react";

type ConfirmOptions = { title?: string; confirmText?: string; danger?: boolean };
type Request = ConfirmOptions & { message: string; resolve: (ok: boolean) => void };

let enqueue: ((request: Request) => void) | null = null;
const asking = new Set<string>();

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (!enqueue) return Promise.resolve(window.confirm(message));
  if (asking.has(message)) return Promise.resolve(false);
  asking.add(message);
  return new Promise((resolve) =>
    enqueue!({
      message,
      ...options,
      resolve: (ok) => {
        asking.delete(message);
        resolve(ok);
      },
    })
  );
}

const isDanger = (request: Request) =>
  request.danger ?? /устга|хаах|татгалз|архив|цэвэрл|буцаах боломжгүй/i.test(request.message);

export function ConfirmHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const current = queue[0] ?? null;

  useEffect(() => {
    enqueue = (request) => setQueue((items) => [...items, request]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (isDanger(current) ? cancelRef : confirmRef).current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
    // close нь current-оос хамаарна — current солигдоход дахин холбоно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function close(ok: boolean) {
    if (!current) return;
    current.resolve(ok);
    setQueue((items) => items.slice(1));
  }

  if (!current) return null;
  const danger = isDanger(current);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button type="button" aria-label="Болих" className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="card relative w-full max-w-md p-5">
        <h2 id="confirm-title" className="text-base font-semibold">{current.title ?? "Баталгаажуулах"}</h2>
        <p id="confirm-message" className="mt-2 whitespace-pre-line text-sm text-text-2">{current.message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={() => close(false)}>Болих</button>
          <button ref={confirmRef} type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>
            {current.confirmText ?? "Тийм"}
          </button>
        </div>
      </div>
    </div>
  );
}
