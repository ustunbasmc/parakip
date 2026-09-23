"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBanner } from "@/components/ErrorBanner";

export interface NotificationPrefs {
  debt_due: boolean;
  budget_alert: boolean;
  transfer_created: boolean;
  space_invite: boolean;
}

// space_invite sütunu şemada var ama uygulamada henüz davet özelliği yok —
// var olmayan bir özellik için anahtar gösterilmez (değer olduğu gibi korunur).
const ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "debt_due", label: "Borç ve ödeme vadeleri", description: "Vadesi yaklaşan veya geçen borç/alacak ve tekrarlayan ödemeler." },
  { key: "budget_alert", label: "Bütçe uyarıları", description: "Bir bütçenin %80'ine ulaşıldığında ve bütçe aşıldığında." },
  { key: "transfer_created", label: "Transferler", description: "Alanındaki hesaplar arasında yeni bir transfer yapıldığında." },
];

/**
 * Her anahtar değiştiği anda kaydedilir (ayrı "kaydet" butonu yok). Kayıt
 * başarısız olursa anahtar eski haline döner ve hata gösterilir.
 */
export function NotificationPreferencesForm({ userId, initial }: { userId: string; initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [savingKey, setSavingKey] = useState<keyof NotificationPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<keyof NotificationPrefs | null>(null);

  async function toggle(key: keyof NotificationPrefs) {
    if (savingKey) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingKey(key);
    setError(null);
    setSavedKey(null);
    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (upsertError) throw upsertError;
      setSavedKey(key);
    } catch {
      setPrefs(prefs);
      setError("Tercih kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Uygulama içi bildirimlerden hangilerini almak istediğini seç. Kapattığın türler için yeni bildirim oluşturulmaz.
      </p>
      {error ? <ErrorBanner message={error} /> : null}
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {ITEMS.map((item) => {
          const on = prefs[item.key];
          const id = `pref-${item.key}`;
          return (
            <li key={item.key} className="flex items-center justify-between gap-3 p-4">
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-semibold text-text-primary">{item.label}</span>
                <span className="block text-xs text-text-muted">{item.description}</span>
                {savedKey === item.key ? <span className="mt-1 block text-[11px] font-semibold text-income">Kaydedildi</span> : null}
              </label>
              <button
                id={id}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={savingKey !== null}
                onClick={() => toggle(item.key)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  on ? "bg-accent" : "bg-border-strong"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-text-muted">
        Destek taleplerine gelen yanıt bildirimleri her zaman iletilir. E-posta veya anlık (push) bildirim şu an
        gönderilmiyor; bildirimler yalnızca uygulama içindeki zil simgesinde görünür.
      </p>
    </div>
  );
}
