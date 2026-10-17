// Server action-ийн үр дүн (амжилт / алдаа) — формууд НЭГ хэв маягаар харуулна.
import type { ActionResult } from "@/lib/actions";

export function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`notice ${result.ok ? "notice-success" : "notice-danger"}`} role="status">
      {result.ok ? (result.message ?? "Амжилттай") : result.error}
    </p>
  );
}
