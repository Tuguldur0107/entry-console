// Landing-ийн чат (entry.mn) — core /api/platform/public-chat-ийн ТӨРӨЛ + ЦЭВЭР туслах
// (tests/saas-chat.test.ts). Эх: core lib/public-chat/store.ts (ConsoleThread, ConsoleMessage).
// Хариу/модерац нь core-ийн Telegram-тай НЭГ store функцээр — Console тусдаа логик бичихгүй.

export type ChatAuthor = "visitor" | "team" | "ai";

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  name: string;
  body: string;
  masked: boolean;
  replyToId: string | null;
  createdAt: string;
  staffName: string | null;
  visitorId: string | null;
  hiddenAt: string | null;
  hiddenBy: string | null;
  relayed: boolean;
};

export type ChatThread = {
  id: string;
  visitorId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  awaitingReply: boolean;
  lastBody: string | null;
  messageCount: number;
  visitorBlocked: boolean;
  registeredUserId: string | null;
};

export const CHAT_ACTIONS = ["reply", "room_post", "hide", "unhide", "block", "unblock", "close", "reopen"] as const;
export type ChatAction = (typeof CHAT_ACTIONS)[number];

export type ChatActionInput =
  | { action: "reply"; threadId: string; body: string }
  | { action: "room_post"; body: string; replyToId?: string | null }
  | { action: "hide" | "unhide"; messageId: string }
  | { action: "block" | "unblock"; visitorId: string }
  | { action: "close" | "reopen"; threadId: string };

export const CHAT_BODY_MAX = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Форм → core-ийн POST бие; буруу бол монгол алдааны текст. */
export function parseChatAction(raw: Record<string, string>): ChatActionInput | { error: string } {
  const action = raw.action as ChatAction;
  if (!CHAT_ACTIONS.includes(action)) return { error: "Үйлдэл буруу" };
  const body = (raw.body ?? "").trim();
  if (action === "reply" || action === "room_post") {
    if (!body) return { error: "Хариу хоосон байна" };
    if (body.length > CHAT_BODY_MAX) return { error: `Хариу ${CHAT_BODY_MAX} тэмдэгтээс ихгүй` };
  }
  switch (action) {
    case "reply":
      return isUuid(raw.threadId) ? { action, threadId: raw.threadId, body } : { error: "Яриа олдсонгүй" };
    case "room_post":
      if (raw.replyToId && !isUuid(raw.replyToId)) return { error: "Хариулах мессеж олдсонгүй" };
      return { action, body, replyToId: raw.replyToId || null };
    case "hide":
    case "unhide":
      return isUuid(raw.messageId) ? { action, messageId: raw.messageId } : { error: "Мессеж олдсонгүй" };
    case "block":
    case "unblock":
      return isUuid(raw.visitorId) ? { action, visitorId: raw.visitorId } : { error: "Зочин олдсонгүй" };
    case "close":
    case "reopen":
      return isUuid(raw.threadId) ? { action, threadId: raw.threadId } : { error: "Яриа олдсонгүй" };
  }
}

export const CHAT_ACTION_DONE: Record<ChatAction, string> = {
  reply: "Хариу илгээгдлээ",
  room_post: "Нийтийн өрөөнд нийтэллээ",
  hide: "Мессежийг нуулаа",
  unhide: "Мессежийг сэргээлээ",
  block: "Зочныг хаалаа",
  unblock: "Зочны хоригийг цуцаллаа",
  close: "Яриаг хаалаа",
  reopen: "Яриаг дахин нээлээ",
};

/** Хариу хүлээж буй яриа эхэнд, дараа нь сүүлийн мессежээр. */
export function sortThreads(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort((a, b) =>
    a.awaitingReply === b.awaitingReply
      ? b.lastMessageAt.localeCompare(a.lastMessageAt)
      : a.awaitingReply
        ? -1
        : 1
  );
}

export const CHAT_THREAD_FILTERS = [
  { value: "", label: "Бүгд" },
  { value: "awaiting", label: "Хариу хүлээж буй" },
  { value: "open", label: "Нээлттэй" },
  { value: "closed", label: "Хаагдсан" },
] as const;

export function filterThreads(threads: ChatThread[], filter: string): ChatThread[] {
  if (filter === "awaiting") return threads.filter((t) => t.awaitingReply && t.status === "open");
  if (filter === "open" || filter === "closed") return threads.filter((t) => t.status === filter);
  return threads;
}
