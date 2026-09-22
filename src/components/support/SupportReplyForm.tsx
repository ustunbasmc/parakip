"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { addSupportMessage } from "@/app/support/actions";
import { MESSAGE_MAX } from "@/lib/support/constants";

/**
 * Kullanıcının mevcut talebine yanıt yazması. Gerçek zamanlı değildir —
 * gönderimden sonra router.refresh() ile sayfa verisi yenilenir.
 * clientRequestId her BAŞARILI gönderimden sonra yenilenir; başarısız bir
 * denemenin tekrarında AYNI kimlik kullanılır, böylece mükerrer mesaj
 * oluşmaz.
 */
export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string>(crypto.randomUUID());
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    const text = body.trim();
    if (!text) {
      setError("Mesaj boş olamaz.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    const result = await addSupportMessage({ ticketId, body: text, clientRequestId: requestIdRef.current }).catch(() => ({
      ok: false as const,
      error: "Bağlantı hatası. Lütfen tekrar dene.",
    }));

    setLoading(false);
    submittingRef.current = false;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    requestIdRef.current = crypto.randomUUID();
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="reply" className="text-sm font-medium text-text-secondary">
        Mesaj yaz
      </label>
      <textarea
        id="reply"
        rows={4}
        maxLength={MESSAGE_MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ek bilgi veya sorunu yaz..."
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[1.0625rem] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={loading} disabled={!body.trim()}>
        Gönder
      </Button>
    </form>
  );
}
