// Entry Console — харилцагчийн бүртгэл. GitHub нь repo-ийн ТЕХНИК төлөв
// (байгаа эсэх, sync run), энэ DB нь БИЗНЕСИЙН бүртгэл (гэрээ, холбоо
// барих, төлбөрийн багц). Төлбөр тооцооны хүснэгтүүд (нэхэмжлэх, төлөлт)
// дараагийн шатанд энд нэмэгдэнэ — customers.id-д уягдана.
import { relations } from "drizzle-orm";
import { boolean, date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const CUSTOMER_STATUSES = ["provisioning", "active", "suspended", "archived"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

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

export const customersRelations = relations(customers, ({ many }) => ({
  events: many(customerEvents),
}));

export const customerEventsRelations = relations(customerEvents, ({ one }) => ({
  customer: one(customers, { fields: [customerEvents.customerId], references: [customers.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type CustomerEvent = typeof customerEvents.$inferSelect;
