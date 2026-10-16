"use client";

// Баталгаажуулах цонх — браузерын `confirm()`-ийн оронд (Entry-ийн загвартай, dark mode,
// гар: Esc = болих, Enter = батлах). `askConfirm` нь Promise<boolean> буцаана; host
// layout-д НЭГ удаа mount хийгдэнэ. Host алга бол (тест г.м.) браузерын confirm руу унана.

import { useEffect, useRef, useState } from "react";

type ConfirmOptions = { title?: string; confirmText?: string; danger?: boolean };
type Request = ConfirmOptions & { message: string; resolve: (ok: boolean) => void };

let enqueue: ((request: Request) => void) | null = null;

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (!enqueue) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => enqueue!({ message, ...options, resolve }));
}

export function ConfirmHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const current = queue[0] ?? null;

  useEffect(() => {
    enqueue = (request) => setQueue((items) => [...items, request]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // close нь current-оос хамаарна — current солигдоход дахин холбоно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function close(ok: boolean) {
    if (!current) return;
    current.resolve(ok);
    setQueue((items) => items.slice(1));
  }

  if (!current) return null;
  const danger = current.danger ?? /устга|хаах|татгалз|архив|цэвэрл|буцаах боломжгүй/i.test(current.message);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button type="button" aria-label="Болих" className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="card relative w-full max-w-md p-5">
        <h2 id="confirm-title" className="text-base font-semibold">{current.title ?? "Баталгаажуулах"}</h2>
        <p id="confirm-message" className="mt-2 whitespace-pre-line text-sm text-text-2">{current.message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>Болих</button>
          <button ref={confirmRef} type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>
            {current.confirmText ?? "Тийм"}
          </button>
        </div>
      </div>
    </div>
  );
}
