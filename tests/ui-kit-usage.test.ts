// БЭЛЭН component / ui-kit / icon-kit-ийг ЗААВАЛ ашиглана (product owner 2026-10-17; core
// entry-accounting-ийн tests/ui-kit-usage.test.ts-тэй ижил дүрэм, CLAUDE.md «UI»). Шинэ кодонд:
//   • lucide-react шууд импорт   → `Icon` / `Icons` (components/ui/icon-registry.ts — core-оос sync)
//   • гараар <svg>               → `Icon`
//   • HTML <table>               → `DataGrid` (components/datagrid)
//   • window.confirm()           → `askConfirm` (components/ui/confirm-dialog.tsx)
//   • өнгөний hex / rgba          → `var(--ea-*)` токен (ui-kit/tokens.css)
//   • огнооны format (Intl, …)   → `fmtDate` / `fmtAgo` (components/ui.tsx)
//   • гараар modal (fixed inset-0 / role="dialog") → `askConfirm` / `TypedConfirmZone`
// бичихийг ХОРИГЛОНО. Хуучин өр KNOWN-д — ЗӨВХӨН багасна (засагдсан файл үлдвэл тест унана).
// Тайлбар (comment) доторх дурдлагыг тоолохгүй.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import test from "node:test";

const ROOTS = ["components", "app"];
// Kit өөрөө (дотоод хэрэгжилт).
const EXEMPT_PREFIXES = ["components/ui/", "components/ui.tsx", "components/datagrid/"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full.split(sep).join("/"));
  }
  return out;
}

const FILES = ROOTS.flatMap((root) => walk(root)).filter((file) => !EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix)));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const SOURCES = new Map(FILES.map((file) => [file, stripComments(readFileSync(file, "utf8"))]));

type Rule = { name: string; pattern: RegExp; replacement: string; known: Set<string> };

const RULES: Rule[] = [
  {
    name: "lucide-react шууд импорт",
    pattern: /from\s+["']lucide-react(?:\/[^"']*)?["']|import\(\s*["']lucide-react/,
    replacement: "Icon / Icons (icon-registry-д бүртгэнэ — core-д нэмээд npm run ui-kit:sync)",
    known: new Set(),
  },
  {
    name: "гараар <svg>",
    pattern: /<svg[\s>]/,
    replacement: "Icon (icon-registry)",
    known: new Set(["components/icons.tsx"]),
  },
  {
    name: "HTML <table>",
    pattern: /<table[\s>]/,
    replacement: "DataGrid (components/datagrid)",
    known: new Set(),
  },
  {
    name: "браузерын window.confirm()",
    pattern: /window\.confirm\(/,
    replacement: "askConfirm (components/ui/confirm-dialog.tsx)",
    known: new Set(),
  },
  {
    name: "component дотор өнгөний hex / rgba",
    pattern: /["'`(\s:[]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b(?![-\w])|\brgba?\(/,
    replacement: "var(--ea-*) токен (ui-kit/tokens.css)",
    known: new Set(),
  },
  {
    name: "component дотор огнооны format",
    pattern: /toLocaleDateString\(|toLocaleTimeString\(|new Intl\.DateTimeFormat\(|timeZone:\s*["']Asia\/Ulaanbaatar["']/,
    replacement: "fmtDate / fmtAgo (components/ui.tsx)",
    known: new Set(),
  },
  {
    name: "гараар modal (fixed inset-0 / role=\"dialog\")",
    pattern: /role=["']dialog["']|\bfixed inset-0\b/,
    replacement: "askConfirm / TypedConfirmZone (components/ui)",
    // Утасны цэсний drawer — modal биш.
    known: new Set(["components/mobile-nav.tsx"]),
  },
];

for (const rule of RULES) {
  test(`ui-kit: ${rule.name} шинээр нэмэгдээгүй (→ ${rule.replacement})`, () => {
    const hits = new Set(FILES.filter((file) => rule.pattern.test(SOURCES.get(file)!)));
    const offenders = [...hits].filter((file) => !rule.known.has(file)).sort();
    const stale = [...rule.known].filter((file) => !hits.has(file)).sort();
    assert.deepEqual(offenders, [], `${rule.name} — бэлэн component ашиглана: ${rule.replacement}\n  ` + offenders.join("\n  "));
    assert.deepEqual(stale, [], `Эдгээр файл ЗАСАГДСАН — KNOWN жагсаалтаас хасна уу:\n  ` + stale.join("\n  "));
  });
}

test("ui-kit: нэр/код бичиж баталгаажуулах UI нэг л газар (TypedConfirmZone)", () => {
  // Нэг хэв маягийг хуулж бичихгүй — 2026-10-17-нд гурван хуулбар байсныг нэгтгэв.
  const copies = FILES.filter((file) => /Баталгаажуулахын тулд/.test(SOURCES.get(file)!));
  assert.deepEqual(copies, [], `TypedConfirmZone ашиглана:\n  ${copies.join("\n  ")}`);
});
