import Link from "next/link";

import { ChatActionButton, ChatComposer } from "@/components/chat-forms";
import { Icons } from "@/components/icons";
import { EmptyState, FilterChips, fmtAgo, fmtDate, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getChatThread, listChatRoom, listChatThreads, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  CHAT_THREAD_FILTERS,
  filterThreads,
  isUuid,
  sortThreads,
  type ChatMessage,
  type ChatThread,
} from "@/lib/saas-chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Landing чат" };

type Params = { tab?: string; filter?: string; thread?: string; reply?: string };

const errorText = (caught: unknown) => (caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught));

export default async function ChatPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireSession();
  const params = await searchParams;
  const tab = params.tab === "room" ? "room" : "threads";
  const filter = params.filter ?? "";

  if (!saasApiConfigured())
    return (
      <div className="space-y-5">
        <PageHeader title="Landing чат" />
        <p className="notice notice-danger">ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.</p>
      </div>
    );

  let threads: ChatThread[] = [];
  let unrelayed = 0;
  let error: string | null = null;
  try {
    const result = await listChatThreads();
    threads = sortThreads(result.threads);
    unrelayed = result.unrelayed24h;
  } catch (caught) {
    error = errorText(caught);
  }
  const awaiting = threads.filter((t) => t.awaitingReply && t.status === "open").length;
  const href = (next: Params) => {
    const merged = { tab, filter, ...next };
    const query = new URLSearchParams(Object.entries(merged).filter((entry): entry is [string, string] => !!entry[1]));
    return `/chat?${query.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Landing чат" sub="entry.mn-ийн зочдын асуулт · хариу Telegram-тай нэг" />

      <FilterChips
        active={tab}
        items={[
          { value: "threads", label: "Хувийн яриа", href: href({ tab: "threads", thread: "", reply: "" }), count: awaiting || undefined },
          { value: "room", label: "Нийтийн өрөө", href: href({ tab: "room", thread: "", filter: "", reply: "" }) },
        ]}
      />

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}
      {unrelayed > 0 ? (
        <p className="notice notice-warning">Сүүлийн 24 цагт {unrelayed} мессеж Telegram руу дамжаагүй — энд хариулна уу.</p>
      ) : null}

      {tab === "threads" ? (
        <ThreadsView threads={threads} filter={filter} threadId={params.thread} href={href} />
      ) : (
        <RoomView replyId={params.reply} href={href} />
      )}
    </div>
  );
}

async function ThreadsView({
  threads,
  filter,
  threadId,
  href,
}: {
  threads: ChatThread[];
  filter: string;
  threadId?: string;
  href: (next: Params) => string;
}) {
  const visible = filterThreads(threads, filter);
  const selectedId = isUuid(threadId) ? threadId : null;
  let detail: Awaited<ReturnType<typeof getChatThread>> = null;
  let detailError: string | null = null;
  if (selectedId) {
    try {
      detail = await getChatThread(selectedId);
      if (!detail) detailError = "Яриа олдсонгүй";
    } catch (caught) {
      detailError = errorText(caught);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <section className={`card overflow-hidden ${selectedId ? "hidden lg:block" : ""}`} aria-label="Яриануд">
        <div className="border-b border-border p-3">
          <FilterChips
            active={filter}
            items={CHAT_THREAD_FILTERS.map((f) => ({
              value: f.value,
              label: f.label,
              href: href({ filter: f.value, thread: selectedId ?? "" }),
              count: filterThreads(threads, f.value).length,
            }))}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState title={threads.length ? "Шүүлтүүрт таарах яриа алга" : "Яриа алга"} />
        ) : (
          <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {visible.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={href({ thread: thread.id })}
                  className="chat-thread-link"
                  data-active={thread.id === selectedId}
                  aria-current={thread.id === selectedId ? "true" : undefined}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{thread.name}</span>
                    <span className="shrink-0 text-xs text-text-3">{fmtAgo(thread.lastMessageAt)}</span>
                  </span>
                  <span className="line-clamp-2 text-xs text-text-3">{thread.lastBody ?? "—"}</span>
                  <span className="flex flex-wrap gap-1">
                    {thread.awaitingReply && thread.status === "open" ? <span className="badge badge-warning">Хариу хүлээж буй</span> : null}
                    {thread.status === "closed" ? <span className="badge badge-muted">Хаагдсан</span> : null}
                    {thread.visitorBlocked ? <span className="badge badge-danger">Хаасан зочин</span> : null}
                    {thread.registeredUserId ? <span className="badge badge-success">Entry хэрэглэгч</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`card flex min-h-[420px] flex-col ${selectedId ? "" : "hidden lg:flex"}`} aria-label="Яриа">
        {detail ? (
          <ThreadDetail thread={detail.thread} messages={detail.messages} backHref={href({ thread: "" })} />
        ) : detailError ? (
          <p className="notice notice-danger m-4">{detailError}</p>
        ) : (
          <EmptyState title="Яриа сонгоно уу" sub={threads.length ? "Зүүн талын жагсаалтаас" : undefined} />
        )}
      </section>
    </div>
  );
}

function ThreadDetail({ thread, messages, backHref }: { thread: ChatThread; messages: ChatMessage[]; backHref: string }) {
  const closed = thread.status === "closed";
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <Link href={backHref} className="mb-1 inline-flex items-center gap-1 text-xs text-text-3 hover:text-text-1 lg:hidden">
            <Icons.arrowLeft className="h-3.5 w-3.5" /> Яриануд
          </Link>
          <h2 className="card-title text-base">{thread.name}</h2>
          <p className="card-sub">
            {[thread.email, thread.phone].filter(Boolean).join(" · ") || "холбоо барих мэдээлэлгүй"} · эхэлсэн {fmtDate(thread.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {closed ? (
            <ChatActionButton action="reopen" field="threadId" value={thread.id} label="Дахин нээх" />
          ) : (
            <ChatActionButton action="close" field="threadId" value={thread.id} label="Хаах" />
          )}
          {thread.visitorBlocked ? (
            <ChatActionButton action="unblock" field="visitorId" value={thread.visitorId} label="Хоригийг цуцлах" />
          ) : (
            <ChatActionButton
              action="block"
              field="visitorId"
              value={thread.visitorId}
              label="Зочныг хаах"
              danger
              confirmText={`«${thread.name}» бичих эрхгүй болно. Үргэлжлүүлэх үү?`}
            />
          )}
        </div>
      </header>
      <ol className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Мессежүүд">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
      </ol>
      <div className="border-t border-border p-4">
        {closed ? (
          <p className="text-sm text-text-3">Яриа хаагдсан — хариулахын тулд дахин нээнэ.</p>
        ) : (
          <ChatComposer key={thread.id} mode="reply" threadId={thread.id} />
        )}
      </div>
    </>
  );
}

function Bubble({ message, quote, actions }: { message: ChatMessage; quote?: ChatMessage | null; actions?: React.ReactNode }) {
  const team = message.author !== "visitor";
  return (
    <li className={`flex ${team ? "justify-end" : "justify-start"}`}>
      <div className="chat-bubble" data-team={team} data-hidden={!!message.hiddenAt}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-3">
          <span className="font-medium text-text-2">{message.name}</span>
          {message.staffName ? <span>({message.staffName})</span> : null}
          <time dateTime={message.createdAt}>{fmtDate(message.createdAt)}</time>
          {message.masked ? <span className="badge badge-muted badge-plain">нуусан мэдээлэлтэй</span> : null}
          {message.hiddenAt ? <span className="badge badge-danger badge-plain">нуусан</span> : null}
          {team && !message.relayed ? <span title="Telegram руу дамжаагүй">· Telegram-гүй</span> : null}
        </div>
        {quote ? (
          <p className="chat-quote mt-1 line-clamp-2 text-xs text-text-3">
            {quote.name}: {quote.body}
          </p>
        ) : null}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
        {actions ? <div className="chat-actions mt-1 flex flex-wrap gap-1">{actions}</div> : null}
      </div>
    </li>
  );
}

async function RoomView({ replyId, href }: { replyId?: string; href: (next: Params) => string }) {
  let messages: ChatMessage[] = [];
  let error: string | null = null;
  try {
    messages = await listChatRoom();
  } catch (caught) {
    error = errorText(caught);
  }
  const byId = new Map(messages.map((m) => [m.id, m]));
  const replyTo = replyId ? byId.get(replyId) ?? null : null;

  return (
    <section className="card flex flex-col" aria-label="Нийтийн өрөө">
      {error ? <p className="notice notice-danger m-4">{error}</p> : null}
      {messages.length === 0 && !error ? (
        <EmptyState title="Нийтийн өрөөнд мессеж алга" />
      ) : (
        <ol className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
          {messages.map((message) => {
            const parent = message.replyToId ? byId.get(message.replyToId) : null;
            return (
              <Bubble
                key={message.id}
                message={message}
                quote={parent}
                actions={
                  <>
                    <Link href={href({ reply: message.id })} className="btn btn-sm btn-ghost" scroll={false}>Хариулах</Link>
                    {message.hiddenAt ? (
                      <ChatActionButton action="unhide" field="messageId" value={message.id} label="Сэргээх" />
                    ) : (
                      <ChatActionButton action="hide" field="messageId" value={message.id} label="Нуух" />
                    )}
                    {message.author === "visitor" && message.visitorId ? (
                      <ChatActionButton
                        action="block"
                        field="visitorId"
                        value={message.visitorId}
                        label="Зочныг хаах"
                        danger
                        subtle
                        confirmText={`«${message.name}» бичих эрхгүй болно. Үргэлжлүүлэх үү?`}
                      />
                    ) : null}
                  </>
                }
              />
            );
          })}
        </ol>
      )}
      <div className="border-t border-border p-4">
        <ChatComposer
          key={replyTo?.id ?? "room"}
          mode="room_post"
          replyTo={replyTo ? { id: replyTo.id, name: replyTo.name } : null}
          cancelReplyHref={href({ reply: "" })}
        />
      </div>
    </section>
  );
}
