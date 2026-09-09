import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL орчны хувьсагч тохируулаагүй (Railway: Entry console DB-ийн DATABASE_URL-ийг reference хийнэ)");

const client = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });

export const db = drizzle(client, { schema });
