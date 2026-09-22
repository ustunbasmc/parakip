"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminLinkArticle, adminReplyToTicket, adminSetTicketStatus } from "@/app/admin/support/actions";
import { MESSAGE_MAX, TICKET_STATUSES, TICKET_STATUS_ADMIN_LABELS } from "@/lib/support/constants";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent";

export function AdminTicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState("answered");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestIdRef = useRef<string>(crypto.randomUUID());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await adminReplyToTicket({
        ticketId,
        body,
        internal,
        nextStatus,
        clientRequestId: requestIdRef.current,
      }).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Hata" }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      requestIdRef.current = crypto.randomUUID();
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex gap-1 rounded-full bg-surface-muted p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setInternal(false)}
          className={`flex-1 rounded-full py-1.5 ${!internal ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
        >
          Kullanıcıya yanıt
        </button>
        <button
          type="button"
          onClick={() => setInternal(true)}
          className={`flex-1 rounded-full py-1.5 ${internal ? "bg-warning text-text-on-accent" : "text-text-secondary"}`}
        >
          İç not
        </button>
      </div>
      <textarea
        rows={5}
        maxLength={MESSAGE_MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={internal ? "Yalnızca adminlerin göreceği not..." : "Kullanıcıya yanıtın..."}
        className={inputClass}
      />
      {!internal ? (
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Yanıttan sonra durum
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={inputClass}>
            <option value="answered">{TICKET_STATUS_ADMIN_LABELS.answered}</option>
            <option value="awaiting_user">{TICKET_STATUS_ADMIN_LABELS.awaiting_user}</option>
            <option value="resolved">{TICKET_STATUS_ADMIN_LABELS.resolved}</option>
            <option value="closed">{TICKET_STATUS_ADMIN_LABELS.closed}</option>
          </select>
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="h-11 rounded-xl bg-accent text-sm font-bold text-text-on-accent disabled:opacity-50"
      >
        {pending ? "Gönderiliyor..." : internal ? "Notu kaydet" : "Yanıtı gönder"}
      </button>
      {!internal ? <p className="text-xs text-text-muted">Kullanıcıya e-posta bildirimi gider (e-posta yapılandırılmışsa).</p> : null}
    </form>
  );
}

export function AdminTicketStatus({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await adminSetTicketStatus(ticketId, next).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Hata",
      }));
      if (!result.ok) {
        setError(result.error);
        setValue(status);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
        Durum
        <select value={value} disabled={pending} onChange={(e) => apply(e.target.value)} className={inputClass}>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_ADMIN_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {status !== "closed" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => apply("closed")}
          className="mt-1 h-9 rounded-xl bg-surface-muted text-xs font-bold text-text-secondary disabled:opacity-50"
        >
          Talebi kapat
        </button>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function AdminTicketArticleLink({
  ticketId,
  currentArticleId,
  articles,
}: {
  ticketId: string;
  currentArticleId: string | null;
  articles: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentArticleId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await adminLinkArticle(ticketId, next || null).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Hata",
      }));
      if (!result.ok) {
        setError(result.error);
        setValue(currentArticleId ?? "");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
        Bağlı yardım makalesi
        <select value={value} disabled={pending} onChange={(e) => apply(e.target.value)} className={inputClass}>
          <option value="">— Yok —</option>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
