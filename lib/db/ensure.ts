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
      // Railway автомат deploy-ийн баганууд (v2.1) — байгаа DB-д нэмнэ
      for (const ddl of [
        `alter table "customers" add column if not exists "auto_deploy" boolean not null default false`,
        `alter table "customers" add column if not exists "railway_project_id" text`,
        `alter table "customers" add column if not exists "railway_environment_id" text`,
        `alter table "customers" add column if not exists "railway_service_id" text`,
        `alter table "customers" add column if not exists "railway_postgres_service_id" text`,
        `alter table "customers" add column if not exists "railway_repo_connected" boolean not null default false`,
        `alter table "customers" add column if not exists "deploy_error" text`,
        // Нөөцлөлт, domain, хяналт, авто sync (v2.2)
        `alter table "customers" add column if not exists "railway_volume_instance_id" text`,
        `alter table "customers" add column if not exists "backup_schedule" text`,
        `alter table "customers" add column if not exists "last_backup_at" timestamptz`,
        `alter table "customers" add column if not exists "custom_domain" text`,
        `alter table "customers" add column if not exists "custom_domain_id" text`,
        `alter table "customers" add column if not exists "dns_target" text`,
        `alter table "customers" add column if not exists "custom_domain_verified" boolean not null default false`,
        `alter table "customers" add column if not exists "health_ok" boolean`,
        `alter table "customers" add column if not exists "health_checked_at" timestamptz`,
        `alter table "customers" add column if not exists "health_changed_at" timestamptz`,
        `alter table "customers" add column if not exists "alerted_at" timestamptz`,
        `alter table "customers" add column if not exists "last_deploy_status" text`,
        `alter table "customers" add column if not exists "auto_sync" boolean not null default false`,
        `alter table "customers" add column if not exists "sync_note" text`,
        // Нээлттэй бүртгүүлэх хүсэлт (v2.3)
        `alter table "customers" add column if not exists "source" text not null default 'console'`,
        `alter table "customers" add column if not exists "request_note" text`,
        `alter table "customers" add column if not exists "decided_at" timestamptz`,
        `alter table "customers" add column if not exists "decision_note" text`,
        // Шинэчлэлт авах эрх — харилцагч тус бүрд (v2.4)
        `alter table "customers" add column if not exists "upstream_access" boolean not null default false`,
        `alter table "customers" add column if not exists "upstream_key_id" integer`,
        `create table if not exists "console_state" ("key" text primary key, "value" jsonb not null, "updated_at" timestamptz not null default now())`,
      ])
        await db.execute(sql.raw(ddl));
    })().catch((error) => {
      ensured = null; // дараагийн хүсэлтэд дахин оролдоно
      throw error;
    });
  return ensured;
}
