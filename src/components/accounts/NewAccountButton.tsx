"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { AccountForm } from "@/components/accounts/AccountForm";
import { PlusIcon } from "@/components/icons";

export function NewAccountButton({ bookId, spaceParam }: { bookId: string; spaceParam: string }) {
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent"
        aria-label="Yeni hesap ekle"
      >
        <PlusIcon size={18} />
      </button>

      <Modal open={open} title="Yeni hesap" onClose={handleClose} confirmClose={confirmClose}>
        <AccountForm
          bookId={bookId}
          homeHref={`/accounts?space=${spaceParam}`}
          variant="modal"
          onSuccess={handleSuccess}
          onDirtyChange={setIsDirty}
        />
      </Modal>
    </>
  );
}
