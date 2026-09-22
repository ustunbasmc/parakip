import { formatSupportDate } from "@/lib/support/constants";

export interface ThreadMessage {
  id: string;
  authorRole: "user" | "admin";
  body: string;
  isInternal?: boolean;
  createdAt: string;
}

/**
 * Talep mesajları — kullanıcı ve destek ekibi mesajları renk ve hizayla
 * ayrılır. `perspective`, "benim" mesajlarımın hangi tarafta olacağını
 * belirler (kullanıcı ekranında kullanıcı sağda, admin ekranında admin
 * sağda). İç notlar yalnızca admin ekranına gelir (RLS kullanıcıya hiç
 * döndürmez) ve ayrıca işaretlenir.
 */
export function MessageThread({
  messages,
  perspective,
}: {
  messages: ThreadMessage[];
  perspective: "user" | "admin";
}) {
  return (
    <ol className="flex min-w-0 flex-col gap-3">
      {messages.map((m) => {
        const mine = m.authorRole === perspective;
        const who = m.isInternal ? "İç not" : m.authorRole === "admin" ? "Parakip Destek" : perspective === "user" ? "Sen" : "Kullanıcı";
        return (
          <li key={m.id} className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[88%] min-w-0 rounded-2xl px-4 py-3 ${
                m.isInternal
                  ? "border border-dashed border-warning bg-warning-soft text-text-primary"
                  : mine
                    ? "rounded-br-md bg-accent text-text-on-accent"
                    : "rounded-bl-md border border-border bg-surface text-text-primary"
              }`}
            >
              <p className={`mb-1 text-[11px] font-bold ${mine && !m.isInternal ? "opacity-80" : "text-text-muted"}`}>{who}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
            </div>
            <span className="mt-1 px-1 text-[11px] text-text-muted">{formatSupportDate(m.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}
