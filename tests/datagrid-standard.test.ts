// Хүснэгтийн стандарт — Entry core-той ижил: жагсаалт бүр DataGrid (AG Grid)-аар.
// `<table>` гараар бичвэл утсан дээр багана дэлгэцээс гадуур гарч, эрэмбэлэлт,
// тогтмол нэрийн багана, картын хувилбар алдагдана (2026-09-25 аудит).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
  });
}

test("app/ ба components/-д гар <table> байхгүй — DataGrid ашиглана", () => {
  const offenders = [...files("app"), ...files("components")].filter((file) =>
    /<table[\s>]/.test(readFileSync(file, "utf8").replace(/\/\/.*$/gm, ""))
  );
  assert.deepEqual(offenders, [], `DataGrid (components/datagrid/data-grid.tsx) ашиглана: ${offenders.join(", ")}`);
});

test("AG Grid зөвхөн datagrid wrapper-ээс import хийгдэнэ (theme, module бүртгэл нэг газар)", () => {
  const offenders = [...files("app"), ...files("components")].filter(
    (file) => !file.startsWith(join("components", "datagrid")) && /from "ag-grid-react"/.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(offenders, []);
});
