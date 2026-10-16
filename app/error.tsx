"use client";

// Хуудасны алдааны хил — нэг хуудас унахад цэс, топбар хэвээр, «Дахин оролдох» товчтой.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center" role="alert">
      <p className="text-sm font-medium">Хуудсыг ачаалж чадсангүй</p>
      <p className="mt-1 break-words text-sm text-text-3">{error.message || "Тодорхойгүй алдаа"}</p>
      {error.digest ? <p className="mono mt-2 text-text-4">{error.digest}</p> : null}
      <button type="button" className="btn mt-4" onClick={reset}>Дахин оролдох</button>
    </div>
  );
}
