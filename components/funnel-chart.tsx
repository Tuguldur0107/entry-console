// Туршилтын funnel — алхам бүрийн тоо, бүртгэлээс хувь, өмнөх алхмаас хувь, медиан хугацаа.
// Зөвхөн --ea-* токен (hex бичихгүй); өргөн = бүртгэлээс хувь.

import { fmtHours, fmtRate, type FunnelStageStat } from "@/lib/saas-insights";

export function FunnelChart({ stages }: { stages: FunnelStageStat[] }) {
  if (stages.length === 0) return null;
  return (
    <ol className="space-y-3" aria-label="Funnel-ийн алхмууд">
      {stages.map((stage, index) => {
        const width = Math.max(2, Math.round((stage.rateFromSignup ?? 0) * 100));
        const skipped = stage.reachedAnyOrder - stage.count;
        return (
          <li key={stage.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[180px_minmax(0,1fr)_200px]">
            <div className="min-w-0">
              <div className="text-sm font-medium">{index + 1}. {stage.label}</div>
              {index > 0 ? (
                <div className="text-xs text-text-3">өмнөхөөс {fmtRate(stage.rateFromPrevious)}</div>
              ) : null}
            </div>
            <div className="order-last col-span-2 sm:order-none sm:col-span-1">
              <div className="funnel-track" role="presentation">
                <div className="funnel-bar" style={{ width: `${width}%` }} data-step={index} />
              </div>
            </div>
            <div className="text-right text-sm tabular-nums">
              <span className="font-semibold">{stage.count.toLocaleString("en-US")}</span>
              <span className="text-text-3"> · {fmtRate(stage.rateFromSignup)}</span>
              <div className="text-xs text-text-3">
                {index > 0 ? `медиан ${fmtHours(stage.medianHoursFromSignup)}` : "когорт"}
                {skipped > 0 ? ` · +${skipped} дараалал алгассан` : ""}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
