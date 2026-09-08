"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelHoldingTransaction } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatRelativeDate, formatDueDateLabel } from "@/lib/format/date";
import { getAccountsForBook, getCategoriesForBook, type AccountOption, type CategoryOption } from "@/lib/dashboard/formData";
import { ArrowUpRightIcon, ArrowDownRightIcon, TransferIcon, TrendingUpIcon, PencilIcon } from "@/components/icons";
import { SwipeToAction } from "@/components/SwipeToAction";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Modal } from "@/components/Modal";
import { IncomeExpenseForm } from "@/components/forms/IncomeExpenseForm";
import type { TransactionHistoryRow, TransferInfo } from "@/lib/dashboard/transactionHistory";

const TYPE_ICON = {
  income: ArrowUpRightIcon,
  expense: ArrowDownRightIcon,
  transfer: TransferIcon,
} as const;

const TYPE_TINT = {
  income: "bg-success-soft text-success",
  expense: "bg-danger-soft text-danger",
  transfer: "bg-accent-soft text-accent",
} as const;

const TYPE_LABEL = { income: "Gelir", expense: "Gider", transfer: "Transfer" } as const;
const BUSINESS_KIND_LABEL = { sale: "Satış", purchase: "Alış", expense: "Masraf" } as const;

/**
 * "Kaynak hesap → hedef hesap" etiketi. Karşı taraf erişilemezse (RLS
 * cross-book gizliliği) GENEL bir ifade kullanılır — hesap adı, tutar,
 * not gibi hiçbir özel bilgi asla sızdırılmaz (o veri zaten hiç
 * sorgulanmadı, yalnızca UI'de yer tutucu metin gösteriliyor).
 */
export function transferDirectionLabel(t: TransferInfo): string {
  const from = t.fromAccountName
    ? t.crossBook && t.fromSpaceName
      ? `${t.fromSpaceName} · ${t.fromAccountName}`
      : t.fromAccountName
    : "Başka bir alan";
  const to = t.toAccountName
    ? t.crossBook && t.toSpaceName
      ? `${t.toSpaceName} · ${t.toAccountName}`
      : t.toAccountName
    : "Başka bir alan";
  return `${from} → ${to}`;
}

export function TransactionListItem({
  row,
  spaceParam,
  bookId,
}: {
  row: TransactionHistoryRow;
  spaceParam: string;
  /** Verilirse düzenleme akışı (kategori/hesap listesi çekmek için) etkinleşir. Verilmezse "Düzenle" hiç gösterilmez (geriye uyumlu). */
  bookId?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editAccounts, setEditAccounts] = useState<AccountOption[]>([]);
  const [editCategories, setEditCategories] = useState<CategoryOption[]>([]);
  const [editDirty, setEditDirty] = useState(false);

  const Icon = row.isInvestment ? TrendingUpIcon : TYPE_ICON[row.type];
  const isCancelled = row.status === "cancelled";
  const isTransfer = row.type === "transfer";
  const isCreditPending = Boolean(row.creditDebtId);
  const isPositive = !isTransfer && !isCreditPending && row.amountCents > 0;
  const kindLabel = row.businessKind ? BUSINESS_KIND_LABEL[row.businessKind] : null;

  // Madde 2: veresiye satış/vadeli alış henüz hiçbir hesap hareketi
  // OLUŞTURMADIĞI için tutar NÖTR gösterilir (+/- yok) — gerçek
  // tahsilat/ödeme yapıldığında AYRI, gerçek bir hareket olarak
  // (o da +/- işaretiyle) listede görünecektir.
  const title = isTransfer && row.transfer
    ? transferDirectionLabel(row.transfer)
    : isCreditPending
      ? `${kindLabel ?? "Veresiye"} — tahsil edilecek${row.counterpartyName ? ` · ${row.counterpartyName}` : ""}`
      : row.note || row.categoryName || (kindLabel ?? TYPE_LABEL[row.type]);

  const subtitle = isTransfer
    ? [row.note, formatRelativeDate(row.occurredAt)].filter(Boolean).join(" · ")
    : isCreditPending
      ? [row.dueDate ? `Vade: ${formatDueDateLabel(row.dueDate)}` : null, formatRelativeDate(row.occurredAt)]
          .filter(Boolean)
          .join(" · ")
      : [row.accountName, kindLabel, row.categoryName, formatRelativeDate(row.occurredAt)].filter(Boolean).join(" · ");

  const href = row.creditDebtId
    ? `/debts/${row.creditDebtId}?space=${spaceParam}`
    : `/transactions/${row.entryId}?space=${spaceParam}`;

  // Kaydırmalı iptal: gerçek, henüz iptal edilmemiş, veresiye BAĞLANTISI
  // OLMAYAN hareketlerde etkindir. Yatırım hareketleri de artık dahildir
  // — ama LIFO kuralı gereği YALNIZCA o holding için EN SON aktif işlemse.
  const canSwipeCancel =
    !isCancelled &&
    !isCreditPending &&
    (!row.isInvestment || row.isLastActiveHoldingTransaction);

  // Düzenleme yalnızca GERÇEK income/expense işlemleri için — transfer
  // (iki taraflı, cross-book gizlilik riski nedeniyle KAPSAM DIŞI, bkz.
  // migration 0059), yatırım, veresiye ve iptal edilmiş kayıtlar hariç.
  const canEdit = Boolean(bookId) && !isCancelled && !isTransfer && !isCreditPending && !row.isInvestment;

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (row.isInvestment && row.holdingTransactionId) {
      const { error: rpcError } = await cancelHoldingTransaction(supabase, {
        p_holding_transaction_id: row.holdingTransactionId,
      });
      setLoading(false);
      setConfirmOpen(false);
      if (rpcError) {
        setError(rpcError.message || "İşlem iptal edilemedi.");
        return;
      }
      router.refresh();
      return;
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", row.transactionId);
    setLoading(false);
    setConfirmOpen(false);
    if (updateError) {
      setError(
        updateError.message.includes("row-level security")
          ? "Bu işlemi iptal etme yetkin yok (yalnızca sahip/yönetici iptal edebilir)."
          : "İptal edilemedi. Lütfen tekrar dene."
      );
      return;
    }
    router.refresh();
  }

  async function handleOpenEdit() {
    if (!bookId) return;
    setEditOpen(true);
    setEditLoading(true);
    const supabase = createClient();
    try {
      const [acc, cat] = await Promise.all([
        getAccountsForBook(supabase, bookId),
        getCategoriesForBook(supabase, bookId, row.type as "income" | "expense"),
      ]);
      setEditAccounts(acc);
      setEditCategories(cat);
    } finally {
      setEditLoading(false);
    }
  }

  function confirmCloseEdit() {
    if (editDirty) return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    return true;
  }

  function handleCloseEdit() {
    if (!confirmCloseEdit()) return;
    setEditOpen(false);
    setEditDirty(false);
  }

  function handleEditSuccess() {
    setEditOpen(false);
    setEditDirty(false);
    router.refresh();
  }

  const card = (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors active:bg-surface-muted ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TYPE_TINT[row.type]}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{title}</p>
          {isCreditPending ? (
            <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning">
              Veresiye
            </span>
          ) : null}
          {row.isInvestment ? (
            <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
              Yatırım
            </span>
          ) : null}
          {isCancelled ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
              İptal
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-text-muted">{subtitle}</p>
      </div>
      <p
        className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${
          isCancelled
            ? "text-text-muted line-through"
            : isTransfer || isCreditPending
              ? "text-text-primary"
              : isPositive
                ? "text-success"
                : "text-danger"
        }`}
      >
        {isPositive ? "+" : ""}
        {formatCentsAsCurrency(Math.abs(row.amountCents), row.currency)}
      </p>
      {/* Masaüstü için düzenleme erişimi — mobilde swipe zaten var, burada
          gizli; masaüstünde swipe olmadığı için ayrı bir buton gerekli. */}
      {canEdit ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenEdit();
          }}
          aria-label="İşlemi düzenle"
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted hover:text-text-primary md:flex"
        >
          <PencilIcon size={15} />
        </button>
      ) : null}
    </Link>
  );

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      <SwipeToAction
        actionLabel="İptal et"
        onAction={() => setConfirmOpen(true)}
        disabled={!canSwipeCancel && !canEdit}
        leftActionLabel={canEdit ? "Düzenle" : undefined}
        onLeftAction={canEdit ? handleOpenEdit : undefined}
      >
        {card}
      </SwipeToAction>

      <ConfirmModal
        open={confirmOpen}
        title="Hareketi iptal et"
        description={
          isTransfer
            ? "Bu transferin HER İKİ bacağı da iptal edilecek ve ilgili hesap bakiyeleri geri alınacak. Bu işlem geri alınamaz, kayıt geçmişte görünmeye devam eder."
            : "Bu hareket iptal edilecek ve hesap bakiyesi geri alınacak. Bu işlem geri alınamaz, kayıt geçmişte görünmeye devam eder."
        }
        confirmLabel="İptal et"
        danger
        loading={loading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />

      {canEdit ? (
        <Modal
          open={editOpen}
          title={row.type === "income" ? "Geliri düzenle" : "Gideri düzenle"}
          onClose={handleCloseEdit}
          confirmClose={confirmCloseEdit}
        >
          {editLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">Yükleniyor...</p>
          ) : (
            <IncomeExpenseForm
              mode="edit"
              editTransactionId={row.transactionId}
              kind={row.type as "income" | "expense"}
              bookId={bookId!}
              homeHref=""
              accounts={editAccounts}
              categories={editCategories}
              businessKind={row.businessKind === "expense" ? "expense" : undefined}
              variant="modal"
              initialValues={{
                amountCents: row.amountCents,
                accountId: row.accountId ?? "",
                categoryId: row.categoryId,
                note: row.note,
                occurredAt: row.occurredAt,
              }}
              onSuccess={handleEditSuccess}
              onDirtyChange={setEditDirty}
            />
          )}
        </Modal>
      ) : null}
    </div>
  );
}
