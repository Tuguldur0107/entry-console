// Хуудас солигдох үеийн skeleton — core сервис, GitHub руу хандах хуудсууд 1–3 сек ачаалдаг.
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Ачаалж байна">
      <div className="space-y-2">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card kpi space-y-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
