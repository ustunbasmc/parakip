"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

/**
 * Hassas işlemler (hesap arşivleme+iptal, hesap silme talebi) öncesi
 * şifre ile yeniden doğrulama. Supabase'in kendi signInWithPassword()
 * akışını kullanır — mevcut oturumu KORUR, yalnızca şifrenin DOĞRU
 * olduğunu teyit eder. ConfirmModal ile AYNI Escape/geri tuşu deseni.
 */
export function ReauthPasswordModal({
  open,
  email,
  title,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  email: string;
  title: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushedHistoryRef = useRef(false);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ reauthModalOpen: true }, "");
    pushedHistoryRef.current = true;

    function handlePopState() {
      pushedHistoryRef.current = false;
      onCancelRef.current();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pushedHistoryRef.current) {
          pushedHistoryRef.current = false;
          window.history.back();
        } else {
          onCancelRef.current();
        }
      }
    }
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
      if (pushedHistoryRef.current) {
        window.history.replaceState(null, "");
        pushedHistoryRef.current = false;
      }
    };
  }, [open]);

  if (!open) return null;

  function dismiss() {
    setPassword("");
    setError(null);
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onCancel();
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Şifreni gir.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Şifre yanlış. Lütfen tekrar dene.");
      return;
    }
    setPassword("");
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={dismiss}>
      <form
        onSubmit={handleConfirm}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl border border-border bg-bg-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
      >
        <p className="mb-1 text-base font-bold text-text-primary">{title}</p>
        <p className="mb-4 text-sm text-text-muted">Devam etmek için şifreni doğrula.</p>
        {error ? <ErrorBanner message={error} /> : null}
        <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="secondary" onClick={dismiss} fullWidth={false}>
            Vazgeç
          </Button>
          <Button type="submit" loading={loading} fullWidth={false}>
            Doğrula
          </Button>
        </div>
      </form>
    </div>
  );
}
