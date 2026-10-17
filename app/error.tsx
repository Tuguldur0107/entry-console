"use client";

import { EmptyState } from "@/components/ui";

// Хуудасны алдааны хил — нэг хуудас унахад цэс, топбар хэвээр, «Дахин оролдох» товчтой.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md" role="alert">
      <EmptyState
        title="Хуудсыг ачаалж чадсангүй"
        sub={[error.message || "Тодорхойгүй алдаа", error.digest].filter(Boolean).join(" · ")}
        action={<button type="button" className="btn" onClick={reset}>Дахин оролдох</button>}
      />
    </div>
  );
}
