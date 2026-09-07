"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCategoriesForBook, type CategoryOption } from "@/lib/dashboard/formData";
import { Modal } from "@/components/Modal";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { PlusIcon } from "@/components/icons";

export function NewBudgetButton({ bookId, spaceParam }: { bookId: string; spaceParam: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const supabase = createClient();
    try {
      setCategories(await getCategoriesForBook(supabase, bookId, "expense"));
    } finally {
      setLoading(false);
    }
  }

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
        onClick={handleOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-text-on-accent"
        aria-label="Yeni bütçe ekle"
      >
        <PlusIcon size={18} />
      </button>

      <Modal open={open} title="Yeni bütçe" onClose={handleClose} confirmClose={confirmClose}>
        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">Yükleniyor...</p>
        ) : (
          <BudgetForm
            bookId={bookId}
            homeHref={`/budgets?space=${spaceParam}`}
            categories={categories}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        )}
      </Modal>
    </>
  );
}
