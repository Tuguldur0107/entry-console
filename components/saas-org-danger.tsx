"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TypedConfirmZone } from "@/components/ui/typed-confirm";
import { deleteSaasOrganizationAction, resetSaasOrganizationAction } from "@/lib/actions";

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Байгууллагын ГҮЙЛГЭЭГ цэвэрлэх — core-ийн POST /api/platform/organizations/reset.
 * Мастер дата, тохиргоо, гишүүд, холболт ҮЛДЭНЭ (туршилтын өгөгдлөөс цэвэр эхлэх).
 */
export function SaasOrgResetZone({ organizationId, orgName }: { organizationId: string; orgName: string }) {
  const router = useRouter();
  return (
    <TypedConfirmZone
      intro="Гүйлгээг цэвэрлэх — мастер дата, тохиргоо, гишүүд үлдэнэ."
      openLabel="Гүйлгээг цэвэрлэх…"
      tone="warning"
      heading={`«${orgName}»-ийн гүйлгээ бүгд устна:`}
      items={[
        "Журнал, касс, АР/АП, бараа материалын хөдөлгөөн, цалин, POS, татварын ноорог",
        "Үлдэнэ: данс, харилцагч, бараа, ажилтан, тохиргоо, банк/татварын холболт, гишүүд",
        "ТЕГ-д бүртгэлтэй eBarimt эсвэл илгээгдэж буй илгээлттэй бол core татгалзана",
      ]}
      expected={orgName}
      expectedLabel="нэрийг"
      matches={(typed) => sameName(typed, orgName)}
      submitLabel="Тийм, гүйлгээг цэвэрлэ"
      pendingLabel="Цэвэрлэж байна…"
      onConfirm={(typed) => resetSaasOrganizationAction(organizationId, typed)}
      onDone={(result, close) => {
        if (!result.ok) return;
        close();
        router.refresh();
      }}
    />
  );
}

/**
 * SaaS байгууллагыг БҮРМӨСӨН устгах — core-ийн DELETE /api/platform/organizations.
 */
export function SaasOrgDangerZone({
  organizationId,
  orgName,
  memberCount,
}: {
  organizationId: string;
  orgName: string;
  memberCount: number;
}) {
  const [purgeUsers, setPurgeUsers] = useState(true);
  const router = useRouter();
  return (
    <TypedConfirmZone
      intro="Байгууллагыг бүх өгөгдөлтэй нь бүрмөсөн устгах."
      openLabel="Бүрмөсөн устгах…"
      heading={`«${orgName}» бүрмөсөн устна:`}
      items={[
        "Бүх журнал, касс, АР/АП, бараа, ҮХ, цалин, POS бичилт",
        "Багцын мөр, QPay төлбөрийн түүх, аудитын мөр, API token",
        `${memberCount} гишүүний эрх (гишүүнчлэл)`,
      ]}
      expected={orgName}
      expectedLabel="нэрийг"
      matches={(typed) => sameName(typed, orgName)}
      submitLabel="Тийм, бүрмөсөн устга"
      pendingLabel="Устгаж байна…"
      onConfirm={(typed) => deleteSaasOrganizationAction(organizationId, typed, purgeUsers)}
      onDone={(result) => {
        if (result.ok) router.push("/subscriptions?deleted=" + encodeURIComponent(orgName));
      }}
    >
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={purgeUsers}
          onChange={(e) => setPurgeUsers(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--ea-primary)]"
        />
        <span>
          Гишүүдийн хэрэглэгчийн бүртгэлийг ч устгах — <span className="text-text-3">зөвхөн өөр байгууллагад гишүүн БИШ (өнчин болсон) хэрэглэгчид; бусад нь хэвээр</span>
        </span>
      </label>
    </TypedConfirmZone>
  );
}
