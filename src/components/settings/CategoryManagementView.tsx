"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createCategory,
  updateCategory,
  deactivateCategory,
  reassignCategoryAndDeactivate,
} from "@/lib/api/financial-rpc";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { FormSelect } from "@/components/forms/FormSelect";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PlusIcon, PencilIcon } from "@/components/icons";
import type { ManagedCategoryRow } from "@/app/settings/categories/page";

const MAX_NAME_LENGTH = 40;

/**
 * Kategori yönetimi — Ev/İşletme deftere özel kullanıcı kategorileri
 * için tam CRUD (oluştur/düzenle/pasifleştir/kullanılmışsa yeniden
 * atayarak kapat). Sistem (global) kategoriler yalnızca GÖRÜNTÜLENİR,
 * "Sistem" rozetiyle ayrılır — düzenlenemez/silinemez (RPC'ler zaten
 * bunu veritabanı seviyesinde de reddeder, burada yalnızca UI'da
 * aksiyon BUTONLARI hiç gösterilmeyerek kullanıcıya net bir sinyal
 * verilir).
 */
export function CategoryManagementView({
  bookId,
  categories,
  canManage,
}: {
  bookId: string;
  categories: ManagedCategoryRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"expense" | "income">("expense");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ManagedCategoryRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<ManagedCategoryRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [needsReassign, setNeedsReassign] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [reassignToId, setReassignToId] = useState<string>("");

  const filtered = categories.filter((c) => c.kind === tab);
  const systemCategories = filtered.filter((c) => !c.isCustom);
  const customCategories = filtered.filter((c) => c.isCustom);

  function friendlyError(message: string | undefined): string {
    if (!message) return "Bir şeyler ters gitti. Lütfen tekrar dene.";
    if (message.includes("duplicate key") || message.includes("categories_unique_active_name_per_scope")) {
      return "Bu isimde bir kategori zaten var.";
    }
    return message;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const trimmed = addName.trim();
    if (!trimmed) {
      setAddError("Kategori adı boş olamaz.");
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setAddError(`Kategori adı en fazla ${MAX_NAME_LENGTH} karakter olabilir.`);
      return;
    }
    setAddLoading(true);
    const supabase = createClient();
    const { error } = await createCategory(supabase, { p_book_id: bookId, p_name: trimmed, p_kind: tab });
    setAddLoading(false);
    if (error) {
      setAddError(friendlyError(error.message));
      return;
    }
    setAddOpen(false);
    setAddName("");
    router.refresh();
  }

  function openEdit(category: ManagedCategoryRow) {
    setEditTarget(category);
    setEditName(category.name);
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Kategori adı boş olamaz.");
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setEditError(`Kategori adı en fazla ${MAX_NAME_LENGTH} karakter olabilir.`);
      return;
    }
    setEditLoading(true);
    const supabase = createClient();
    const { error } = await updateCategory(supabase, { p_category_id: editTarget.id, p_name: trimmed });
    setEditLoading(false);
    if (error) {
      setEditError(friendlyError(error.message));
      return;
    }
    setEditTarget(null);
    router.refresh();
  }

  function openRemove(category: ManagedCategoryRow) {
    setRemoveTarget(category);
    setRemoveError(null);
    setNeedsReassign(false);
    setReassignToId("");
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    setRemoveError(null);
    const supabase = createClient();

    if (!needsReassign) {
      // Önce doğrudan pasifleştirmeyi dene — kullanılmamışsa BAŞARILI olur.
      const { error } = await deactivateCategory(supabase, { p_category_id: removeTarget.id });
      setRemoveLoading(false);
      if (!error) {
        setRemoveTarget(null);
        router.refresh();
        return;
      }
      // Kullanılmışsa RPC bunu net bir Türkçe mesajla reddeder — bu
      // durumda kullanıcıya "yeniden ata" seçeneğini AÇARIZ.
      const match = error.message.match(/(\d+) islemde kullanilmis/);
      if (match) {
        setUsageCount(Number(match[1]));
        setNeedsReassign(true);
        return;
      }
      setRemoveError(friendlyError(error.message));
      return;
    }

    // Yeniden atama akışı (kullanılmış kategori).
    const { error } = await reassignCategoryAndDeactivate(supabase, {
      p_category_id: removeTarget.id,
      p_new_category_id: reassignToId || null,
    });
    setRemoveLoading(false);
    if (error) {
      setRemoveError(friendlyError(error.message));
      return;
    }
    setRemoveTarget(null);
    router.refresh();
  }

  const reassignOptions = customCategories
    .concat(systemCategories)
    .filter((c) => c.id !== removeTarget?.id);

  return (
    <div className="flex flex-col gap-4 pt-3 pb-4">
      <div className="flex gap-1 rounded-full bg-surface-muted p-1">
        <button
          onClick={() => setTab("expense")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${tab === "expense" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
        >
          Gider kategorileri
        </button>
        <button
          onClick={() => setTab("income")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${tab === "income" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
        >
          Gelir kategorileri
        </button>
      </div>

      {canManage ? (
        <Button variant="secondary" onClick={() => setAddOpen(true)} fullWidth={false} className="w-fit">
          <PlusIcon size={16} />
          Yeni kategori
        </Button>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Kendi kategorilerim</p>
        {customCategories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-4 text-center text-sm text-text-muted">
            Henüz özel kategori eklemedin.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {customCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
                <span className="text-sm font-medium text-text-primary">{c.name}</span>
                {canManage ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(c)} aria-label={`${c.name} kategorisini düzenle`} className="text-text-muted hover:text-accent">
                      <PencilIcon size={15} />
                    </button>
                    <button onClick={() => openRemove(c)} className="text-xs font-semibold text-danger">
                      Kaldır
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Sistem kategorileri</p>
        <div className="flex flex-col gap-2">
          {systemCategories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted p-3.5">
              <span className="text-sm font-medium text-text-secondary">{c.name}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-text-muted">Sistem</span>
            </div>
          ))}
        </div>
      </div>

      {/* Yeni kategori ekleme */}
      <Modal open={addOpen} title="Yeni kategori" onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 pb-1">
          {addError ? <ErrorBanner message={addError} /> : null}
          <p className="text-xs text-text-muted">{tab === "expense" ? "Gider" : "Gelir"} kategorisi olarak eklenecek.</p>
          <TextField
            label="Kategori adı"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
          />
          <Button type="submit" loading={addLoading}>
            Ekle
          </Button>
        </form>
      </Modal>

      {/* Kategori düzenleme */}
      <Modal open={editTarget !== null} title="Kategoriyi düzenle" onClose={() => setEditTarget(null)}>
        <form onSubmit={handleEdit} className="flex flex-col gap-3 pb-1">
          {editError ? <ErrorBanner message={editError} /> : null}
          <p className="text-xs text-text-muted">
            Bu isim değişikliği geçmiş işlemlerde de otomatik yansır — hiçbir kayıt bozulmaz.
          </p>
          <TextField
            label="Kategori adı"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
          />
          <Button type="submit" loading={editLoading}>
            Kaydet
          </Button>
        </form>
      </Modal>

      {/* Kaldırma / yeniden atama */}
      <Modal open={removeTarget !== null} title="Kategoriyi kaldır" onClose={() => setRemoveTarget(null)}>
        <div className="flex flex-col gap-3 pb-1">
          {removeError ? <ErrorBanner message={removeError} /> : null}
          {needsReassign ? (
            <>
              <p className="text-sm text-text-secondary">
                <strong>&quot;{removeTarget?.name}&quot;</strong> kategorisi {usageCount} işlemde kullanılmış —
                doğrudan kaldırılamaz. Bu işlemleri başka bir kategoriye taşıyabilir veya
                &quot;Kategorisiz&quot; bırakabilirsin. Geçmiş kayıtların hiçbiri silinmez.
              </p>
              <FormSelect
                label="Yeni kategori"
                value={reassignToId}
                onChange={(e) => setReassignToId(e.target.value)}
                options={[
                  { value: "", label: "Kategorisiz bırak" },
                  ...reassignOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <Button onClick={handleRemove} loading={removeLoading} className="!bg-danger">
                Taşı ve kaldır
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                <strong>&quot;{removeTarget?.name}&quot;</strong> kategorisi kaldırılacak. Kullanılmamışsa hemen
                pasifleştirilir; kullanılmışsa bir sonraki adımda hangi kategoriye taşınacağını seçebileceksin.
              </p>
              <Button onClick={handleRemove} loading={removeLoading} className="!bg-danger">
                Devam et
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
