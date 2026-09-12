// Entry Console — харилцагчийн бүртгэл. GitHub нь repo-ийн ТЕХНИК төлөв
// (байгаа эсэх, sync run), энэ DB нь БИЗНЕСИЙН бүртгэл (гэрээ, холбоо
// барих, төлбөрийн багц). Төлбөр тооцооны хүснэгтүүд (нэхэмжлэх, төлөлт)
// дараагийн шатанд энд нэмэгдэнэ — customers.id-д уягдана.
import { relations } from "drizzle-orm";
import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * pending      — нээлттэй бүртгүүлэх хүсэлт (/signup); repo/Railway ХАРААХАН үүсээгүй
 * provisioning — батлагдсан; core дээр provision workflow явж байна
 * active / suspended / archived — ердийн амьдралын мөчлөг
 * rejected     — хүсэлтийг татгалзсан (бүртгэл лавлагаанд үлдэнэ)
 */
export const CUSTOMER_STATUSES = ["pending", "provisioning", "active", "suspended", "archived", "rejected"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
/** Хүсэлтийн төлөвүүд — repo/Railway байхгүй, зөвхөн бүртгэл */
export const REQUEST_STATUSES: readonly CustomerStatus[] = ["pending", "rejected"];
export const isRequestStatus = (s: CustomerStatus) => REQUEST_STATUSES.includes(s);

export const CUSTOMER_SOURCES = ["console", "signup", "api"] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export const CUSTOMER_PLANS = ["pilot", "basic", "pro"] as const;
export type CustomerPlan = (typeof CUSTOMER_PLANS)[number];

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Repo нэрийн суурь: entry-<slug>. Өөрчлөгдөхгүй. */
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** Регистр / ТТД */
  registerNo: text("register_no"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  /** owner/entry-<slug> */
  githubRepo: text("github_repo").notNull(),
  /** Уригдсан GitHub хэрэглэгчид (таслалаар) — түүхийн зорилгоор */
  githubUsers: text("github_users"),
  appUrl: text("app_url"),
  status: text("status").$type<CustomerStatus>().notNull().default("provisioning"),
  plan: text("plan").$type<CustomerPlan>().notNull().default("pilot"),
  monthlyFee: numeric("monthly_fee", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("MNT"),
  /** Төлбөр эхлэх огноо (туршилтын хугацаа дууссаны дараа) */
  billingStartsAt: date("billing_starts_at"),
  seededRef: text("seeded_ref"),
  notes: text("notes"),
  /** Repo бэлэн болмогц Railway-д автоматаар deploy хийх эсэх */
  autoDeploy: boolean("auto_deploy").notNull().default(false),
  railwayProjectId: text("railway_project_id"),
  railwayEnvironmentId: text("railway_environment_id"),
  railwayServiceId: text("railway_service_id"),
  railwayPostgresServiceId: text("railway_postgres_service_id"),
  /** GitHub repo Railway service-д холбогдсон эсэх (project token-оор холбогдохгүй) */
  railwayRepoConnected: boolean("railway_repo_connected").notNull().default(false),
  /** Сүүлийн deploy оролдлогын алдаа (амжилттай бол null) */
  deployError: text("deploy_error"),
  /** Postgres volume instance (backup хуваарь, жагсаалт энд) */
  railwayVolumeInstanceId: text("railway_volume_instance_id"),
  /** "DAILY,WEEKLY" — Railway volume backup хуваарь */
  backupSchedule: text("backup_schedule"),
  lastBackupAt: timestamp("last_backup_at", { withTimezone: true }),
  /** Custom domain (govi.entry.mn) — Railway custom domain */
  customDomain: text("custom_domain"),
  customDomainId: text("custom_domain_id"),
  /** DNS CNAME-д бичих утга */
  dnsTarget: text("dns_target"),
  customDomainVerified: boolean("custom_domain_verified").notNull().default(false),
  /** Хяналт: сүүлийн /api/health үр дүн (null = шалгаагүй) */
  healthOk: boolean("health_ok"),
  healthCheckedAt: timestamp("health_checked_at", { withTimezone: true }),
  healthChangedAt: timestamp("health_changed_at", { withTimezone: true }),
  alertedAt: timestamp("alerted_at", { withTimezone: true }),
  lastDeployStatus: text("last_deploy_status"),
  /** Core шинэчлэлтийг автоматаар: sync PR нээх + шалгалт давсан бол merge */
  autoSync: boolean("auto_sync").notNull().default(false),
  /** Sync-ийн саад (conflict, шалгалт унасан) — анхаарах зүйлсэд */
  syncNote: text("sync_note"),
  /**
   * Шинэчлэлт авах эрх (захиалгын гарц). true = core repo дээр энэ харилцагчийн
   * deploy key бүртгэлтэй, upstream-sync ажиллана. false = цуцлагдсан; байгаа
   * код, deploy хэвээр үлдэнэ (lib/upstream-access.ts).
   */
  upstreamAccess: boolean("upstream_access").notNull().default(false),
  /** Core repo дээрх deploy key-ийн id — цуцлахад хэрэгтэй */
  upstreamKeyId: integer("upstream_key_id"),
  /**
   * Харилцагчийн ӨӨРИЙН repo дээрх БИЧИХ эрхтэй deploy key-ийн id. Sync салбарыг
   * үүгээр push хийнэ — GITHUB_TOKEN нь `.github/workflows/` файл push хийж
   * чаддаггүй тул workflow хөндсөн шинэчлэлт үүнгүйгээр унана.
   */
  syncPushKeyId: integer("sync_push_key_id"),
  /** Хаанаас бүртгэгдсэн: console маягт | нээлттэй /signup | REST */
  source: text("source").$type<CustomerSource>().notNull().default("console"),
  /** Хүсэлт гаргагчийн тайлбар (/signup) */
  requestNote: text("request_note"),
  /** Хүсэлтийг батлах/татгалзах шийдвэрийн цаг, тайлбар */
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Харилцагчийн түүх — үүссэн, sync, төлөв өөрчлөгдсөн, тэмдэглэл. */
export const customerEvents = pgTable("customer_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  /** provisioned | activated | sync | invite | status | note | billing */
  type: text("type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Console-ийн дотоод төлөв (хяналтын сүүлийн ажиллагаа г.м.) */
export const consoleState = pgTable("console_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  events: many(customerEvents),
}));

export const customerEventsRelations = relations(customerEvents, ({ one }) => ({
  customer: one(customers, { fields: [customerEvents.customerId], references: [customers.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type CustomerEvent = typeof customerEvents.$inferSelect;
