"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateSpaceDetails, archiveSpace } from "@/lib/api/onboarding-rpc";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { FormSelect } from "@/components/forms/FormSelect";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ArchiveIcon, BuildingIcon, WalletIcon } from "@/components/icons";
import type { ManagedSpace } from "@/lib/dashboard/formData";

const SECTOR_OPTIONS = [
  { value: "retail", label: "Perakende" },
  { value: "service", label: "Hizmet" },
  { value: "manufacturing", label: "Üretim" },
  { value: "technology", label: "Teknoloji" },
  { value: "food", label: "Gıda & İçecek" },
  { value: "construction", label: "İnşaat" },
  { value: "health", label: "Sağlık" },
  { value: "education", label: "Eğitim" },
  { value: "other", label: "Diğer" },
];

/**
 * Tek bir alanın yönetim kartı: isim/sektör düzenleme (rol bazlı
 * kısıtlı) + arşivleme/yeniden etkinleştirme. Tüm yazma işlemleri
 * update_space_details()/archive_space() SECURITY DEFINER RPC'leri
 * üzerinden — asla doğrudan .from('spaces').update(...) ile değil.
 */
export function SpaceManagementCard({ space }: { space: ManagedSpace }) {
  const router = useRouter();
  const canEditName = space.role === "owner";
  const canEditSector = space.type === "business" && (space.role === "owner" || space.role === "admin");
  const canArchive = space.role === "owner";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [sector, setSector] = useState(space.sector ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (canEditName && !trimmed) {
      setError("Alan adı boş olamaz.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await updateSpaceDetails(supabase, {
      p_space_id: space.id,
      p_name: canEditName && trimmed !== space.name ? trimmed : undefined,
      p_sector: canEditSector && sector !== (space.sector ?? "") ? sector : undefined,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message || "Güncellenemedi. Lütfen tekrar dene.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleArchiveToggle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await archiveSpace(supabase, {
      p_space_id: space.id,
      p_archived: !space.isArchived,
    });
    setLoading(false);
    setConfirmOpen(false);
    if (rpcError) {
      setError(rpcError.message || "İşlem gerçekleştirilemedi.");
      return;
    }
    // Aktif alan arşivlenmişse: bir sonraki /home ziyaretinde
    // getUserSpacesBasic() zaten arşivlenmiş alanı listeden çıkarır ve
    // resolveActiveSpace() otomatik olarak başka bir aktif alana düşer —
    // ayrıca bir yönlendirme koduna GEREK YOK, bu doğal olarak işler.
    router.refresh();
  }

  const Icon = space.type === "business" ? BuildingIcon : WalletIcon;

  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${space.isArchived ? "opacity-60" : ""}`}>
      {error ? (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <TextField
                label="Alan adı"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditName}
              />
              {space.type === "business" ? (
                <FormSelect
                  label="Sektör"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  options={SECTOR_OPTIONS}
                  placeholder="Seçilmedi"
                  disabled={!canEditSector}
                />
              ) : null}
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={loading} fullWidth={false}>
                  Kaydet
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={loading} fullWidth={false}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-text-primary">{space.name}</p>
              <p className="text-xs text-text-muted">
                {space.type === "business" ? "İşletme" : "Ev"}
                {space.sector ? ` · ${SECTOR_OPTIONS.find((o) => o.value === space.sector)?.label ?? space.sector}` : ""}
                {" · "}
                {space.role === "owner" ? "Sahip" : space.role === "admin" ? "Yönetici" : "Editör"}
                {space.isArchived ? " · Arşivlenmiş" : ""}
              </p>
              <div className="mt-2.5 flex gap-2">
                {canEditName || canEditSector ? (
                  <button onClick={() => setEditing(true)} className="text-xs font-semibold text-accent">
                    Düzenle
                  </button>
                ) : null}
                {canArchive ? (
                  <button
                    onClick={() => setConfirmOpen(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-text-secondary"
                  >
                    <ArchiveIcon size={13} />
                    {space.isArchived ? "Arşivden çıkar" : "Arşivle"}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={space.isArchived ? "Alanı arşivden çıkar" : "Alanı arşivle"}
        description={
          space.isArchived
            ? `"${space.name}" tekrar aktif hale gelecek.`
            : `"${space.name}" arşivlendiğinde alan seçicide görünmeyecek ve yeni işlem eklenemeyecek — ama tüm geçmiş kayıtlar korunur, istediğin zaman geri getirebilirsin. Bu alana bağlı ücretli bir abonelik varsa, arşivleme faturalandırmayı ETKİLEMEZ; aboneliğini ayrıca yönetmen gerekir.`
        }
        confirmLabel={space.isArchived ? "Arşivden çıkar" : "Arşivle"}
        loading={loading}
        onConfirm={handleArchiveToggle}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
