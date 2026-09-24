"use client";

import { Modal } from "@/components/Modal";
import type { InstallPlatform } from "@/lib/pwa/install";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{n}</span>
      <span className="pt-0.5 text-sm text-text-secondary">{children}</span>
    </li>
  );
}

/**
 * Tarayıcının kendi kurulum penceresi olmadığında (iPhone Safari, bazı
 * Android tarayıcıları) gösterilen "Ana ekrana ekle" adımları.
 */
export function InstallInstructionsModal({ open, platform, onClose }: { open: boolean; platform: InstallPlatform; onClose: () => void }) {
  return (
    <Modal open={open} title="Ana ekrana ekle" onClose={onClose}>
      <div className="flex flex-col gap-4 pb-2">
        {platform === "ios" ? (
          <>
            <p className="text-sm text-text-secondary">iPhone/iPad&apos;de Parakip&apos;i ana ekranına eklemek için:</p>
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Safari&apos;de alttaki (veya adres çubuğundaki) <strong>Paylaş</strong> simgesine dokun (kare içinden yukarı ok).
              </Step>
              <Step n={2}>
                Açılan listede <strong>&quot;Ana Ekrana Ekle&quot;</strong> seçeneğini bulup dokun.
              </Step>
              <Step n={3}>
                Sağ üstteki <strong>&quot;Ekle&quot;</strong>ye dokun, sonra Parakip&apos;i ana ekrandaki simgesinden aç.
              </Step>
            </ol>
            <p className="text-xs text-text-muted">
              Chrome gibi başka bir tarayıcı kullanıyorsan bu adımlar için Safari&apos;de aç. Zaten eklediysen ana ekrandaki Parakip
              simgesinden açman yeterli; adım kendiliğinden tamamlanır.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">Parakip&apos;i ana ekranına eklemek için:</p>
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Tarayıcının sağ üstündeki <strong>menü</strong> simgesine (⋮) dokun.
              </Step>
              <Step n={2}>
                <strong>&quot;Ana ekrana ekle&quot;</strong> veya <strong>&quot;Uygulamayı yükle&quot;</strong> seçeneğine dokun ve onayla.
              </Step>
              <Step n={3}>Parakip&apos;i bundan sonra ana ekrandaki simgesinden aç.</Step>
            </ol>
            <p className="text-xs text-text-muted">Zaten eklediysen ana ekrandaki Parakip simgesinden açman yeterli; bu adım kendiliğinden tamamlanır.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
