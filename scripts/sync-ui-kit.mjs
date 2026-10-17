// Entry-ийн ui-kit / icon-kit-ийг core (entry-accounting)-оос ХУУЛНА — Console-д гараар засахгүй.
//
//   node scripts/sync-ui-kit.mjs            ../entry-accounting-аас хуулна
//   node scripts/sync-ui-kit.mjs --check    зөрүүтэй бол exit 1 (хуулахгүй)
//   node scripts/sync-ui-kit.mjs --from <core-ийн хавтас>
//
// Өнгө, дүрс нэмэх/өөрчлөх бол core-д засаад энэ скриптээр авчирна (README «Дизайн»).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const UI_KIT_FILES = [
  "ui-kit/tokens.css",
  "ui-kit/ICON-KIT.md",
  "components/ui/icon-registry.ts",
  "components/ui/icon.tsx",
  "components/ui/icon-kit.module.css",
];

const args = process.argv.slice(2);
const check = args.includes("--check");
const fromIndex = args.indexOf("--from");
const core = resolve(fromIndex >= 0 ? args[fromIndex + 1] : "../entry-accounting");
const here = resolve(".");

if (!existsSync(join(core, "components/ui/icon-registry.ts"))) {
  console.error(`core олдсонгүй: ${core} — --from <entry-accounting-ийн хавтас>`);
  process.exit(2);
}

const stale = [];
for (const file of UI_KIT_FILES) {
  const source = readFileSync(join(core, file), "utf8");
  const target = join(here, file);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === source) continue;
  stale.push(file);
  if (!check) writeFileSync(target, source);
}

if (stale.length === 0) console.log("ui-kit core-тэй ижил");
else if (check) {
  console.error(`core-оос хоцорсон: ${stale.join(", ")} — node scripts/sync-ui-kit.mjs`);
  process.exit(1);
} else console.log(`хуулсан: ${stale.join(", ")}`);
