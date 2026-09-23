"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const COOLDOWN_S = 60;

/**
 * Onay e-postasını yeniden gönderir (Supabase auth.resend). E-posta spam'e
 * düştüğünde veya süresi dolduğunda hesabın takılı kalmasını önler. Kötüye
 * kullanıma karşı 60 sn bekleme; Supabase de kendi hız sınırını uygular.
 */
export function ResendConfirmation({ email, next }: { email: string; next?: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setStatus(null);
    const callback = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: callback } });
    setSending(false);
    if (error) {
      setStatus({ ok: false, text: "Gönderilemedi. Birkaç dakika sonra tekrar dene." });
      return;
    }
    setStatus({ ok: true, text: `${email} adresine yeni bir onay bağlantısı gönderdik. Spam klasörünü de kontrol et.` });
    setCooldown(COOLDOWN_S);
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0 || !email}
        className="text-sm font-semibold text-accent disabled:text-text-muted"
      >
        {sending ? "Gönderiliyor..." : cooldown > 0 ? `Tekrar göndermek için ${cooldown} sn` : "Onay e-postasını tekrar gönder"}
      </button>
      {status ? (
        <p role="status" className={`max-w-xs text-xs ${status.ok ? "text-success" : "text-danger"}`}>
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
