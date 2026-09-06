"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/api/onboarding-rpc";

/**
 * TEMA KALICILIĞI STRATEJİSİ:
 * - next-themes, localStorage'a yazar ve <html> üzerinde class'ı (light/dark)
 *   sayfa hiç yenilenmeden anında değiştirir (next-themes'in kendi inline
 *   script'i, ilk boyamadan ÖNCE doğru class'ı uygular — "flash" olmaz).
 * - localStorage TEK BAŞINA yeterli kabul edilmiyor ("yalnızca localStorage'a
 *   güvenme" kuralı) — bu yüzden oturum açık bir kullanıcı için, mount
 *   olduğunda profiles.theme_preference sunucudan çekilir ve YEREL değerle
 *   FARKLIYSA sunucudaki değer uygulanır (sunucu kaynak-of-truth'tur; ör.
 *   kullanıcı başka bir cihazda tema değiştirmişse, bu cihaz da senkronize
 *   olur).
 * - Kullanıcı temayı DEĞİŞTİRDİĞİNDE (ayarlar sayfasından), hem next-themes
 *   (anında, sayfa yenilenmeden görsel değişim) hem de veritabanı (kalıcı
 *   kayıt) güncellenir — bkz. useThemePreference() hook'u.
 *
 * DÜZELTİLEN YARIŞ DURUMU: Bu sunucu senkronizasyonu ASENKRON'dur. Kullanıcı
 * temayı değiştirip DB yazması tamamlanmadan (ör. yavaş bağlantı) hemen bir
 * başka sekmeye/pencereye geçerse ve o ekran ThemeSync'i YENİDEN monte
 * ederse (ör. tam sayfa yenileme), eski (henüz güncellenmemiş) DB değeri
 * geri çekilip kullanıcının SEÇTİĞİ yeni temanın üzerine YAZILABİLİRDİ.
 * Bunu önlemek için `hasLocalChangeThisSession` global bayrağı kullanılır:
 * bir kez kullanıcı BİLİNÇLİ olarak tema değiştirdiyse (useThemePreference
 * üzerinden), bu oturumdaki SONRAKİ hiçbir ThemeSync mount'u artık
 * sunucudan gelen değerle YEREL değeri EZMEZ — sunucu zaten bu değişikliği
 * (biraz gecikmeli de olsa) yakalayacaktır, kullanıcının gördüğü tema asla
 * geriye sıçramaz.
 */
let hasLocalChangeThisSession = false;

export function ThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function syncFromServer() {
      if (hasLocalChangeThisSession) return; // bkz. yukarıdaki yarış durumu notu

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled || hasLocalChangeThisSession) return;

      const { data, error } = await getThemePreference(supabase, user.id);
      if (error || !data || cancelled || hasLocalChangeThisSession) return;

      const localValue =
        typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;

      if (data.theme_preference && data.theme_preference !== localValue) {
        setTheme(data.theme_preference);
      }
    }

    syncFromServer();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Ayarlar ekranında kullanılacak hook: temayı hem anında (next-themes)
 * hem kalıcı olarak (veritabanı) değiştirir. Kullanıcı oturum açmamışsa
 * yalnızca yerel (next-themes/localStorage) tarafı güncellenir — onboarding
 * öncesi tema seçimi de sorunsuz çalışsın diye.
 */
export function useThemePreference() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [saving, setSaving] = useState(false);

  const changeTheme = useCallback(
    async (next: ThemePreference) => {
      hasLocalChangeThisSession = true; // bkz. ThemeSync'teki yarış durumu notu
      setTheme(next);
      setSaving(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await setThemePreference(supabase, user.id, next);
        }
      } finally {
        setSaving(false);
      }
    },
    [setTheme]
  );

  return {
    theme: theme as ThemePreference | undefined,
    resolvedTheme,
    changeTheme,
    saving,
  };
}
