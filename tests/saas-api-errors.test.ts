// Core-ийн 404-ийг ялгах: зам огт алга (хуучин core) ↔ core-ийн өөрийн «олдсонгүй».
// Хуучин хувилбарт бүх 404 «core-ийг шинэчил» болдог байсан — устгагдсан байгууллагыг
// цэвэрлэх гэхэд админ шаардлагагүй deploy хийхэд хүргэж байв.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { getChatThread, postChatAction, resetSaasOrganization, SaasApiError } from "../lib/saas-api";

const realFetch = globalThis.fetch;
let reply: () => Response;

beforeEach(() => {
  process.env.ENTRY_SAAS_API_URL = "http://core.test";
  process.env.ENTRY_SAAS_API_KEY = "key";
  globalThis.fetch = (async () => reply()) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const html404 = () => new Response("<!doctype html><title>404</title>", { status: 404, headers: { "Content-Type": "text/html" } });
const ORG = "00000000-0000-4000-8000-000000000001";

async function rejection(promise: Promise<unknown>): Promise<SaasApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SaasApiError);
    return error;
  }
  assert.fail("алдаа шидээгүй");
}

test("core-ийн өөрийн 404 мессежээрээ дамжина — «шинэчил» гэхгүй", async () => {
  reply = json(404, { ok: false, error: "Байгууллага олдсонгүй" });
  const error = await rejection(resetSaasOrganization(ORG, "Нэр", "console"));
  assert.equal(error.message, "Байгууллага олдсонгүй");
  assert.equal(error.routeMissing, false);

  reply = json(404, { ok: false, error: "Нийтийн өрөөний мессеж олдсонгүй" });
  const hide = await rejection(postChatAction({ action: "hide", messageId: ORG }, "console"));
  assert.equal(hide.message, "Нийтийн өрөөний мессеж олдсонгүй");
});

test("зам алга (JSON биш 404) → core-ийн хувилбар шинэчлэх", async () => {
  reply = html404;
  const error = await rejection(resetSaasOrganization(ORG, "Нэр", "console"));
  assert.match(error.message, /Core сервисийн хувилбар гүйлгээ цэвэрлэх-ийг мэдэхгүй/);
  assert.equal(error.routeMissing, true);
});

test("dedicated горимын 404 — горимыг заана", async () => {
  reply = json(404, { ok: false, error: "Зөвхөн saas горимд" });
  const error = await rejection(resetSaasOrganization(ORG, "Нэр", "console"));
  assert.match(error.message, /^Зөвхөн saas горимд.*ENTRY_DEPLOYMENT_MODE=saas/);
});

test("яриа олдсонгүй → null, зам алга → алдаа", async () => {
  reply = json(404, { ok: false, error: "Яриа олдсонгүй" });
  assert.equal(await getChatThread(ORG), null);
  reply = html404;
  await rejection(getChatThread(ORG));
});
