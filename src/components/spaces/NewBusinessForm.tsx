"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSpaceWithBook } from "@/lib/api/onboarding-rpc";
import { amountInputToCents } from "@/lib/format/amount";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { AmountInput } from "@/components/AmountInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormSuccessState } from "@/components/forms/FormSuccessState";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";

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
 * "İşletme oluşturmak" ile "ücretli abonelik başlatmak" KASITLI OLARAK
 * BİRBİRİNDEN AYRIDIR: bu form yalnızca create_space_with_book('business')
 * çağırır (ücretsiz, sınırsız sayıda oluşturulabilir — mevcut veritabanı
 * yalnızca Ev alanını 1 ile sınırlar, İşletme'yi sınırlamaz). Aşağıdaki
 * "Premium özellikler" notu yalnızca bilgilendirmedir, hiçbir ödeme akışı
 * TETİKLEMEZ (henüz bir abonelik/ödeme altyapısı kurulmadı).
 */
export function NewBusinessForm({ hasExistingBusiness }: { hasExistingBusiness: boolean }) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = name !== "" || sector !== "" || openingBalance !== "";
  useUnsavedChangesGuard(isDirty && !success);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (submittingRef.current) return; // çift tıklama koruması

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("İşletme adı boş olamaz.");
      return;
    }

    const cents = openingBalance.trim() === "" ? 0 : amountInputToCents(openingBalance);
    if (cents === null) {
      setError("Açılış bakiyesi geçerli bir tutar değil.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();

    // TEK ve ATOMİK RPC çağrısı: alan + defter + sektör + varsayılan Kasa
    // hesabı hepsi AYNI veritabanı işleminde yazılır. Kasa hesabı
    // oluşturma başarısız olursa (ör. negatif tutar) TÜM işlem geri
    // alınır — hiçbir "kısmi başarı" durumu artık MÜMKÜN DEĞİL.
    const { data, error: rpcError } = await createSpaceWithBook(supabase, {
      p_type: "business",
      p_name: trimmedName,
      p_currency: "TRY",
      p_sector: sector || null,
      p_create_default_account: true,
      p_default_account_opening_balance_cents: cents,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (rpcError || !data) {
      setError(rpcError?.message || "İşletme alanı oluşturulamadı. Lütfen tekrar dene.");
      return;
    }

    // Başarı mesajı YALNIZCA buraya ulaşıldığında (yani sektör dahil TÜM
    // kayıtlar başarıyla yazıldığında) gösterilir — ayrı, sessizce
    // başarısız olabilecek bir adım artık yok.
    setSuccess(true);
    router.refresh();
    setTimeout(() => router.push(`/home?space=${data.space_id}`), 1100);
  }

  if (success) {
    return (
      <AppShell variant="subpage" title="İşletme alanı" backFallbackHref="/home">
        <FormSuccessState message={`"${name.trim()}" oluşturuldu.`} />
      </AppShell>
    );
  }

  return (
    <AppShell
      variant="subpage"
      title="İşletme alanı oluştur"
      backFallbackHref="/home"
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      <form id="new-business-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        {hasExistingBusiness ? (
          <p className="rounded-2xl bg-surface-muted p-3.5 text-sm text-text-secondary">
            Zaten bir İşletme alanın var. İstersen bir tane daha ekleyebilirsin — ayrı bir defter ve hesaplarla
            tamamen bağımsız çalışır.
          </p>
        ) : null}

        <TextField
          label="İşletme adı"
          placeholder="Örn. Ayşe'nin Kafesi"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <FormSelect
          label="Sektör (isteğe bağlı)"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          options={SECTOR_OPTIONS}
          placeholder="Seçiniz"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Para birimi</label>
          <div className="flex h-14 items-center rounded-2xl border border-border bg-surface-muted px-4 text-[1.0625rem] text-text-muted">
            Türk Lirası (TRY)
          </div>
        </div>

        <AmountInput
          label="Açılış bakiyesi (isteğe bağlı)"
          value={openingBalance}
          onChange={setOpeningBalance}
          allowNegative={false}
          hint="Boş bırakırsan işletmen 0 TL'lik bir Kasa hesabıyla başlar."
        />

        <div className="mt-1 rounded-2xl border border-dashed border-border-strong p-3.5 text-xs text-text-muted">
          Bu, ücretsiz Temel İşletme alanıdır. Premium özellikler (ör. çoklu kullanıcı, gelişmiş raporlar) yakında
          ayrı bir abonelik ekranından sunulacak — bu formu doldurmak hiçbir ödeme başlatmaz.
        </div>
      </form>

      <div className="sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" form="new-business-form" loading={submitting}>
          İşletme alanını oluştur
        </Button>
      </div>
    </AppShell>
  );
}
