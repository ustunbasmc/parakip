"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { PartyForm } from "@/components/parties/PartyForm";
import { PlusIcon } from "@/components/icons";

export function NewPartyButton({
  type,
  spaceId,
  spaceParam,
}: {
  type: "customer" | "supplier";
  spaceId: string;
  spaceParam: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const label = type === "customer" ? "Yeni müşteri ekle" : "Yeni tedarikçi ekle";
  const title = type === "customer" ? "Yeni müşteri" : "Yeni tedarikçi";
  const homeHref = type === "customer" ? `/customers?space=${spaceParam}` : `/suppliers?space=${spaceParam}`;

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
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent text-text-on-accent"
        aria-label={label}
      >
        <PlusIcon size={18} />
      </button>

      <Modal open={open} title={title} onClose={handleClose} confirmClose={confirmClose}>
        <PartyForm
          type={type}
          spaceId={spaceId}
          homeHref={homeHref}
          variant="modal"
          onSuccess={handleSuccess}
          onDirtyChange={setIsDirty}
        />
      </Modal>
    </>
  );
}
