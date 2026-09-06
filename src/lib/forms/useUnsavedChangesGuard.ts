"use client";

import { useEffect } from "react";

/**
 * "Formdan çıkarken kaydedilmemiş veri varsa uyarı gösterilmeli" kuralı.
 *
 * KAPSAM (bilinçli sınır): Bu hook, sekme kapatma/yenileme/başka bir
 * adrese gitme gibi TARAYICI seviyesi çıkışları (beforeunload) yakalar.
 * Ayrıca bu sayfanın kendi GÖRÜNÜR geri butonu da (BackButton'a `guard`
 * geçirilerek) aynı window.confirm() ile korunur — bu, bir formdan
 * çıkmanın en yaygın yoludur. Cihazın donanım geri tuşu/kaydırma
 * hareketi (popstate) YAKALANMAZ: Next.js App Router'ın kendi geçmiş
 * yönetimiyle çakışma riski taşıyan (ör. yinelenen/bozuk geçmiş
 * girdileri) bir popstate engelleme mekanizması, bu turun kapsamında
 * bilinçli olarak uygulanmadı — bkz. proje raporu.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      // Modern tarayıcılarda özel mesaj gösterilmez (güvenlik nedeniyle
      // tarayıcının kendi standart metni kullanılır); returnValue set
      // etmek tetiklemek için hâlâ gereklidir.
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}

/** BackButton'a geçirilecek, window.confirm tabanlı basit onay fonksiyonu. */
export function confirmLeaveIfDirty(isDirty: boolean): boolean {
  if (!isDirty) return true;
  return window.confirm("Kaydedilmemiş değişiklikleriniz var. Çıkmak istediğinize emin misiniz?");
}
