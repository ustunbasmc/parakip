"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { DebtForm } from "@/components/debts/DebtForm";
import { PlusIcon } from "@/components/icons";

/**
 * "/debts/new" sayfası KALDIRILMADI (derin bağlantı/fallback için hâlâ
 * çalışıyor) — bu buton yalnızca aynı DebtForm bileşenini bir Modal
 * içinde açar, tam sayfa geçişi yapmaz.
 */
export function NewDebtButton({ bookId, spaceParam }: { bookId: string; spaceParam: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  function confirmClose() {
    if (isDirty) return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    return true;
  }

  function handleClose() {
    if (!confirmClose()) return;
    setOpen(false);
    setIsDirty(false);
  }

  function handleSuccess() {
    setOpen(false);
    setIsDirty(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent"
        aria-label="Yeni borç/alacak ekle"
      >
        <PlusIcon size={18} />
      </button>

      <Modal open={open} title="Yeni borç/alacak" onClose={handleClose} confirmClose={confirmClose}>
        <DebtForm
          bookId={bookId}
          homeHref={`/debts?space=${spaceParam}`}
          variant="modal"
          onSuccess={handleSuccess}
          onDirtyChange={setIsDirty}
        />
      </Modal>
    </>
  );
}
