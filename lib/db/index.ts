// Postgres холболт — LAZY: анхны query дээр л үүснэ. Next.js build (page
// data collection) болон DATABASE_URL-гүй орчинд import хийхэд унахгүй.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

function connect(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL орчны хувьсагч тохируулаагүй (Railway: Entry console DB-ийн DATABASE_URL-ийг reference хийнэ)"
    );
  cached = drizzle(postgres(url, { max: 5, idle_timeout: 20 }), { schema });
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = connect();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
