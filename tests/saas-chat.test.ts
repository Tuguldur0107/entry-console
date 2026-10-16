// Landing чатын цэвэр туслахууд (lib/saas-chat.ts) — формын задлал, эрэмбэ, шүүлт.
import assert from "node:assert/strict";
import test from "node:test";

import { CHAT_BODY_MAX, filterThreads, parseChatAction, sortThreads, type ChatThread } from "../lib/saas-chat";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

test("форм → core-ийн үйлдэл; буруу ID, хоосон хариуг татгалзана", () => {
  assert.deepEqual(parseChatAction({ action: "reply", threadId: ID, body: "  Сайн байна уу  " }), { action: "reply", threadId: ID, body: "Сайн байна уу" });
  assert.deepEqual(parseChatAction({ action: "reply", threadId: ID, body: "  " }), { error: "Хариу хоосон байна" });
  assert.deepEqual(parseChatAction({ action: "reply", threadId: "x", body: "a" }), { error: "Яриа олдсонгүй" });
  assert.match((parseChatAction({ action: "room_post", body: "a".repeat(CHAT_BODY_MAX + 1) }) as { error: string }).error, /ихгүй/);
  assert.deepEqual(parseChatAction({ action: "room_post", body: "Сайн", replyToId: "" }), { action: "room_post", body: "Сайн", replyToId: null });
  assert.deepEqual(parseChatAction({ action: "room_post", body: "Сайн", replyToId: "bad" }), { error: "Хариулах мессеж олдсонгүй" });
  assert.deepEqual(parseChatAction({ action: "hide", messageId: ID }), { action: "hide", messageId: ID });
  assert.deepEqual(parseChatAction({ action: "block", visitorId: ID }), { action: "block", visitorId: ID });
  assert.deepEqual(parseChatAction({ action: "close", threadId: ID }), { action: "close", threadId: ID });
  assert.deepEqual(parseChatAction({ action: "delete_all" }), { error: "Үйлдэл буруу" });
});

const thread = (id: string, awaitingReply: boolean, lastMessageAt: string, status = "open"): ChatThread => ({
  id,
  visitorId: ID,
  name: id,
  email: null,
  phone: null,
  status,
  createdAt: lastMessageAt,
  lastMessageAt,
  awaitingReply,
  lastBody: null,
  messageCount: 1,
  visitorBlocked: false,
  registeredUserId: null,
});

test("хариу хүлээж буй яриа эхэнд, дараа нь сүүлийн мессежээр; шүүлт", () => {
  const threads = [
    thread("a", false, "2026-10-16T10:00:00Z"),
    thread("b", true, "2026-10-15T10:00:00Z"),
    thread("c", true, "2026-10-16T09:00:00Z"),
    thread("d", true, "2026-10-16T11:00:00Z", "closed"),
  ];
  assert.deepEqual(sortThreads(threads).map((t) => t.id), ["d", "c", "b", "a"]);
  assert.deepEqual(filterThreads(threads, "awaiting").map((t) => t.id), ["b", "c"]);
  assert.deepEqual(filterThreads(threads, "closed").map((t) => t.id), ["d"]);
  assert.equal(filterThreads(threads, "").length, 4);
});
