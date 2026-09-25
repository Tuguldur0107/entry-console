"use client";

// Утасны цэс (<768px). Урьд нь топбарт 5 товч нэг мөрөнд багтаж ЧАДАХГҮЙ тул
// хуудас бүр 200px+ хажуу тийш гүйлгэгддэг байв — одоо товч + гулсдаг самбар,
// десктопын `Nav`-тай ИЖИЛ жагсаалт (давхар жагсаалт хөтлөхгүй).

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Icons } from "./icons";
import { Nav } from "./nav";

export function MobileNav({ footer }: { footer?: React.ReactNode }) {
  const path = usePathname();
  // Нээсэн хуудсаа санана — хуудас солигдмогц өөрөө хаагдана (effect-гүй).
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === path;
  const setOpen = (value: boolean) => setOpenedAt(value ? path : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenedAt(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Цэс нээх" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
        <Icons.menu className="h-5 w-5" />
      </button>
      {/* Portal: топбарын backdrop-blur нь fixed хүүхдийг ӨӨРТӨӨ хорьдог (containing block) —
          body-д render хийхгүй бол самбар зөвхөн топбарын өндөрт гарч байв. */}
      {open ? createPortal(
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Цэс">
          <button type="button" aria-label="Цэс хаах" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface px-3 py-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold tracking-tight">
                Entry <span className="text-text-3">Console</span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Цэс хаах" onClick={() => setOpen(false)}>
                <Icons.close className="h-5 w-5" />
              </button>
            </div>
            <Nav />
            {footer ? <div className="mt-auto px-2 pt-4 text-xs text-text-3">{footer}</div> : null}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
