"use client";

import { useState } from "react";
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
  PlusIcon,
} from "@/components/icons";

type ModalKind = "income" | "expense" | "transfer" | "sale" | "purchase";

interface ActionDef {
  label: string;
  Icon: typeof ArrowUpRightIcon;
  tint: string;
  modalKind: ModalKind;
  /** Yalnızca modalKind="expense" ile birlikte — "Masraf ekle" akışını Ev'in genel Gider ekle'sinden ayırt eder (bkz. business.ts). */
  businessKind?: "expense";
}

const HOME_ACTIONS: ActionDef[] = [
  { label: "Gelir ekle", Icon: ArrowUpRightIcon, tint: "bg-income-soft text-income", modalKind: "income" },
  { label: "Gider ekle", Icon: ArrowDownRightIcon, tint: "bg-expense-soft text-expense", modalKind: "expense" },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-balance-soft text-balance", modalKind: "transfer" },
];

/**
 * İşletme alanı, Ev'in yalnızca daha geniş versiyonu DEĞİLDİR — satış/
 * alış/masraf merkezli çalışır. Tahsilat/Ödeme burada YOKTUR (bilinçli
 * sadeleştirme) — bunlar zaten Borçlar ekranından, ilgili kaydın
 * üzerinden yapılıyor.
 */
const BUSINESS_ACTIONS: ActionDef[] = [
  { label: "Satış ekle", Icon: ArrowUpRightIcon, tint: "bg-income-soft text-income", modalKind: "sale" },
  { label: "Alış ekle", Icon: ArrowDownRightIcon, tint: "bg-expense-soft text-expense", modalKind: "purchase" },
  { label: "Masraf ekle", Icon: ArrowDownRightIcon, tint: "bg-warning-soft text-warning", modalKind: "expense", businessKind: "expense" },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-balance-soft text-balance", modalKind: "transfer" },
];

const MODAL_TITLES: Record<ModalKind, string> = {
  income: "Gelir ekle",
  expense: "Gider ekle",
  transfer: "Transfer yap",
  sale: "Satış ekle",
  purchase: "Alış ekle",
};

/**
 * Sağ altta sabit duran TEK bir "+" (FAB) hızlı işlem butonu. Basılınca
 * ÖNCE bir seçim menüsü (aynı Modal altyapısında), bir eylem seçilince
 * İSE o eylemin formu (yine aynı Modal içinde, içerik değişerek) açılır
 * — hiçbir sayfa değişikliği YOKTUR, ikisi de aynı Modal örneğinin
 * FARKLI aşamalarıdır (kod tekrarı yok, tek Escape/dışarı-tık/geri-tuşu
 * davranışı ikisine de otomatik uygulanır).
 *
 * Gerekli veri (hesaplar/kategoriler/müşteri-tedarikçi/çoklu alan
 * hesapları) yalnızca BİR EYLEM SEÇİLDİĞİNDE istemci tarafında çekilir —
 * sayfa ilk yüklemesini YAVAŞLATMAZ.
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind | null>(null);
  const [modalBusinessKind, setModalBusinessKind] = useState<"expense" | undefined>(undefined);
  const [loadingData, setLoadingData] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [spaces, setSpaces] = useState<SpaceWithAccounts[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isOpen = menuOpen || modalKind !== null;

  async function selectAction(kind: ModalKind, businessKind?: "expense") {
    setMenuOpen(false);
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
    // Yalnızca FORM aşamasında (menüde hiçbir veri girilmediğinden dirty olamaz) sorulur.
    if (modalKind && isDirty) {
      return window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğine emin misin?");
    }
    return true;
  }

  function resetAll() {
    setMenuOpen(false);
    setModalKind(null);
    setModalBusinessKind(undefined);
    setIsDirty(false);
  }

  function handleClose() {
    if (!confirmClose()) return;
    resetAll();
  }

  function handleSuccess() {
    const savedLabel = title;
    resetAll();
    router.refresh();
    // Kısa, kendiliğinden kaybolan başarı bildirimi (form modalı kapandıktan sonra).
    setToast(`${savedLabel.replace(/ ekle$| yap$/, "")} kaydedildi`);
    window.setTimeout(() => setToast(null), 2600);
  }

  const homeHref = `/home?space=${spaceParam}`;
  const title = menuOpen
    ? "Hızlı işlem"
    : modalKind
      ? modalKind === "expense" && modalBusinessKind === "expense"
        ? "Masraf ekle"
        : MODAL_TITLES[modalKind]
      : "";

  return (
    <>
      {/* Alt navigasyonun (~3.75rem + güvenli alan) ÜZERİNDE sabit durur;
          masaüstünde alt navigasyon olmadığından sağ alt köşeye iner. */}
      <button
        onClick={() => setMenuOpen(true)}
        aria-label="Hızlı işlem ekle"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl text-text-on-accent transition-transform duration-200 active:scale-95 md:bottom-8 md:right-8"
        style={{
          background: "linear-gradient(145deg, var(--color-accent-hover), var(--color-accent))",
          boxShadow: "var(--glow-accent), inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>
          <PlusIcon size={26} />
        </span>
      </button>

      {toast ? (
        <div
          role="status"
          className="animate-toast fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-text-primary shadow-xl md:bottom-10"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-income-soft text-income" aria-hidden="true">
            ✓
          </span>
          <span className="truncate">{toast}</span>
        </div>
      ) : null}

      <Modal open={isOpen} title={title} onClose={handleClose} confirmClose={confirmClose}>
        {menuOpen ? (
          <div role="menu" className="grid grid-cols-2 gap-2 pb-1">
            {actions.map((action, i) => (
              <button
                key={action.label}
                role="menuitem"
                onClick={() => selectAction(action.modalKind, action.businessKind)}
                className="animate-rise flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted active:scale-[0.98]"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.tint}`}>
                  <action.Icon size={19} />
                </span>
                <span className="text-sm font-bold text-text-primary">{action.label}</span>
              </button>
            ))}
          </div>
        ) : loadingData || !modalKind ? (
          <div className="flex flex-col gap-3 py-4" aria-label="Yükleniyor" role="status">
            <div className="skeleton h-14 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
          </div>
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
