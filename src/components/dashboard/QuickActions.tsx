"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getAccountsForBook,
  getCategoriesForBook,
  getUserSpacesWithAccounts,
  type AccountOption,
  type CategoryOption,
  type SpaceWithAccounts,
} from "@/lib/dashboard/formData";
import { getCustomers, getSuppliers, type PartyRow } from "@/lib/dashboard/customers";
import { Modal } from "@/components/Modal";
import { IncomeExpenseForm } from "@/components/forms/IncomeExpenseForm";
import { TransferForm } from "@/components/forms/TransferForm";
import { SaleForm } from "@/components/business/SaleForm";
import { PurchaseForm } from "@/components/business/PurchaseForm";
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  TransferIcon,
  ClockIcon,
} from "@/components/icons";

type ModalKind = "income" | "expense" | "transfer" | "sale" | "purchase";

interface ActionDef {
  label: string;
  Icon: typeof ArrowUpRightIcon;
  tint: string;
  href: (bookId: string, spaceParam: string) => string;
  /** Belirtilirse tıklayınca SAYFA DEĞİŞTİRMEZ — bunun yerine bir modal açar. */
  modalKind?: ModalKind;
  /** Yalnızca modalKind="expense" ile birlikte — "Masraf ekle" akışını Ev'in genel Gider ekle'sinden ayırt eder (bkz. business.ts). */
  businessKind?: "expense";
}

const HOME_ACTIONS: ActionDef[] = [
  { label: "Gelir ekle", Icon: ArrowUpRightIcon, tint: "bg-success-soft text-success", href: (b, s) => `/add-transaction?type=income&book_id=${b}&space=${s}`, modalKind: "income" },
  { label: "Gider ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/add-transaction?type=expense&book_id=${b}&space=${s}`, modalKind: "expense" },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-accent-soft text-accent", href: (b, s) => `/add-transaction?type=transfer&book_id=${b}&space=${s}`, modalKind: "transfer" },
];

/**
 * İşletme alanı, Ev'in yalnızca daha geniş versiyonu DEĞİLDİR — satış/
 * alış/tahsilat/ödeme merkezli çalışır. Tahsilat/Ödeme, YENİ bir form
 * GEREKTİRMEZ: doğrudan mevcut Borçlar listesine (yön filtresiyle) gider,
 * oradaki "Ödeme ekle" akışı zaten hesap hareketi entegrasyonunu içerir.
 */
const BUSINESS_ACTIONS: ActionDef[] = [
  { label: "Satış ekle", Icon: ArrowUpRightIcon, tint: "bg-success-soft text-success", href: (b, s) => `/sales/new?book_id=${b}&space=${s}`, modalKind: "sale" },
  { label: "Alış ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/purchases/new?book_id=${b}&space=${s}`, modalKind: "purchase" },
  { label: "Masraf ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/add-transaction?type=expense&business_kind=expense&book_id=${b}&space=${s}`, modalKind: "expense", businessKind: "expense" },
  { label: "Tahsilat ekle", Icon: ClockIcon, tint: "bg-success-soft text-success", href: (_b, s) => `/debts?space=${s}&direction=receivable` },
  { label: "Ödeme ekle", Icon: ClockIcon, tint: "bg-danger-soft text-danger", href: (_b, s) => `/debts?space=${s}&direction=payable` },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-accent-soft text-accent", href: (b, s) => `/add-transaction?type=transfer&book_id=${b}&space=${s}`, modalKind: "transfer" },
];

const MODAL_TITLES: Record<ModalKind, string> = {
  income: "Gelir ekle",
  expense: "Gider ekle",
  transfer: "Transfer yap",
  sale: "Satış ekle",
  purchase: "Alış ekle",
};

/**
 * En sık kullanılacak eylemler, tek dokunuşla erişilebilir büyük
 * hedefler olarak. book_id ve space, aktif alan hangisiyse ORADAN
 * geçirilir — form ekranı Ev/İşletme arasında ASLA karışmaz.
 *
 * Gelir/Gider/Transfer/Satış/Alış artık sayfa DEĞİŞTİRMEZ — arkadaki
 * dashboard kalırken bir Modal (mobilde bottom-sheet, masaüstünde
 * ortalı) açılır. Gerekli veri (hesaplar/kategoriler/müşteri-tedarikçi/
 * çoklu alan hesapları) yalnızca modal AÇILDIĞINDA istemci tarafında
 * çekilir — sayfa ilk yüklemesini YAVAŞLATMAZ. Eski `/add-transaction`,
 * `/sales/new`, `/purchases/new` rotaları hiç kaldırılmadı, derin
 * bağlantı/geri uyumluluk için aynen çalışmaya devam ediyor.
 */
export function QuickActions({
  bookId,
  spaceParam,
  variant = "home",
}: {
  bookId: string;
  spaceParam: string;
  variant?: "home" | "business";
}) {
  const router = useRouter();
  const actions = variant === "business" ? BUSINESS_ACTIONS : HOME_ACTIONS;

  const [modalKind, setModalKind] = useState<ModalKind | null>(null);
  const [modalBusinessKind, setModalBusinessKind] = useState<"expense" | undefined>(undefined);
  const [loadingData, setLoadingData] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [spaces, setSpaces] = useState<SpaceWithAccounts[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  async function openModal(kind: ModalKind, businessKind?: "expense") {
    setModalKind(kind);
    setModalBusinessKind(businessKind);
    setLoadingData(true);
    const supabase = createClient();
    try {
      if (kind === "income" || kind === "expense") {
        const [acc, cat] = await Promise.all([
          getAccountsForBook(supabase, bookId),
          getCategoriesForBook(supabase, bookId, kind),
        ]);
        setAccounts(acc);
        setCategories(cat);
      } else if (kind === "transfer") {
        setSpaces(await getUserSpacesWithAccounts(supabase));
      } else if (kind === "sale") {
        const [acc, cat, customers] = await Promise.all([
          getAccountsForBook(supabase, bookId),
          getCategoriesForBook(supabase, bookId, "income"),
          getCustomers(supabase, spaceParam, { archived: false }),
        ]);
        setAccounts(acc);
        setCategories(cat);
        setParties(customers);
      } else if (kind === "purchase") {
        const [acc, cat, suppliers] = await Promise.all([
          getAccountsForBook(supabase, bookId),
          getCategoriesForBook(supabase, bookId, "expense"),
          getSuppliers(supabase, spaceParam, { archived: false }),
        ]);
        setAccounts(acc);
        setCategories(cat);
        setParties(suppliers);
      }
    } finally {
      setLoadingData(false);
    }
  }

  function confirmClose() {
    if (isDirty) return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    return true;
  }

  function handleCloseModal() {
    if (!confirmClose()) return;
    setModalKind(null);
    setModalBusinessKind(undefined);
    setIsDirty(false);
  }

  function handleSuccess() {
    setModalKind(null);
    setModalBusinessKind(undefined);
    setIsDirty(false);
    router.refresh();
  }

  const homeHref = `/home?space=${spaceParam}`;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) =>
          action.modalKind ? (
            <button
              key={action.label}
              onClick={() => openModal(action.modalKind!, action.businessKind)}
              className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-center transition-colors active:bg-surface-muted"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${action.tint}`}>
                <action.Icon size={16} />
              </span>
              <span className="text-xs font-semibold text-text-primary">{action.label}</span>
            </button>
          ) : (
            <Link
              key={action.label}
              href={action.href(bookId, spaceParam)}
              className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-center transition-colors active:bg-surface-muted"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${action.tint}`}>
                <action.Icon size={16} />
              </span>
              <span className="text-xs font-semibold text-text-primary">{action.label}</span>
            </Link>
          )
        )}
      </div>

      <Modal
        open={modalKind !== null}
        title={modalKind ? (modalKind === "expense" && modalBusinessKind === "expense" ? "Masraf ekle" : MODAL_TITLES[modalKind]) : ""}
        onClose={handleCloseModal}
        confirmClose={confirmClose}
      >
        {loadingData || !modalKind ? (
          <p className="py-8 text-center text-sm text-text-muted">Yükleniyor...</p>
        ) : modalKind === "income" || modalKind === "expense" ? (
          <IncomeExpenseForm
            kind={modalKind}
            bookId={bookId}
            homeHref={homeHref}
            accounts={accounts}
            categories={categories}
            businessKind={modalBusinessKind}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : modalKind === "transfer" ? (
          <TransferForm
            bookId={bookId}
            homeHref={homeHref}
            spaces={spaces}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : modalKind === "sale" ? (
          <SaleForm
            bookId={bookId}
            homeHref={homeHref}
            accounts={accounts}
            categories={categories}
            customers={parties}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : modalKind === "purchase" ? (
          <PurchaseForm
            bookId={bookId}
            homeHref={homeHref}
            accounts={accounts}
            categories={categories}
            suppliers={parties}
            variant="modal"
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
          />
        ) : null}
      </Modal>
    </>
  );
}
