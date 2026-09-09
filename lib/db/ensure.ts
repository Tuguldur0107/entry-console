// Schema-г апп эхлэхэд баталгаажуулна (идемпотент DDL) — Railway-ийн
// pre-deploy тохиргооноос үл хамааран хүснэгтүүд заавал бий болно.
// lib/db/schema.ts-тэй ИЖИЛ байх ёстой; багана нэмбэл энд ALTER ... IF NOT
// EXISTS мөр нэмнэ (drizzle-kit push нь хөгжүүлэлтийн хэрэгсэл хэвээр).
import { sql } from "drizzle-orm";

import { db } from "./index";

let ensured: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ensured)
    ensured = (async () => {
      await db.execute(sql`
        create table if not exists "customers" (
          "id" uuid primary key default gen_random_uuid(),
          "slug" text not null unique,
          "display_name" text not null,
          "register_no" text,
          "contact_name" text,
          "contact_email" text,
          "contact_phone" text,
          "github_repo" text not null,
          "github_users" text,
          "app_url" text,
          "status" text not null default 'provisioning',
          "plan" text not null default 'pilot',
          "monthly_fee" numeric(14,2) not null default '0',
          "currency" text not null default 'MNT',
          "billing_starts_at" date,
          "seeded_ref" text,
          "notes" text,
          "created_at" timestamptz not null default now(),
          "updated_at" timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists "customer_events" (
          "id" uuid primary key default gen_random_uuid(),
          "customer_id" uuid not null references "customers"("id") on delete cascade,
          "type" text not null,
          "message" text not null,
          "created_at" timestamptz not null default now()
        )
      `);
    })().catch((error) => {
      ensured = null; // дараагийн хүсэлтэд дахин оролдоно
      throw error;
    });
  return ensured;
}
