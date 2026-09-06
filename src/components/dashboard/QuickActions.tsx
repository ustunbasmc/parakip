import Link from "next/link";
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  TransferIcon,
  ClockIcon,
} from "@/components/icons";

interface ActionDef {
  label: string;
  Icon: typeof ArrowUpRightIcon;
  tint: string;
  href: (bookId: string, spaceParam: string) => string;
}

const HOME_ACTIONS: ActionDef[] = [
  { label: "Gelir ekle", Icon: ArrowUpRightIcon, tint: "bg-success-soft text-success", href: (b, s) => `/add-transaction?type=income&book_id=${b}&space=${s}` },
  { label: "Gider ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/add-transaction?type=expense&book_id=${b}&space=${s}` },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-accent-soft text-accent", href: (b, s) => `/add-transaction?type=transfer&book_id=${b}&space=${s}` },
];

/**
 * İşletme alanı, Ev'in yalnızca daha geniş versiyonu DEĞİLDİR — satış/
 * alış/tahsilat/ödeme merkezli çalışır. Tahsilat/Ödeme, YENİ bir form
 * GEREKTİRMEZ: doğrudan mevcut Borçlar listesine (yön filtresiyle) gider,
 * oradaki "Ödeme ekle" akışı zaten hesap hareketi entegrasyonunu içerir.
 */
const BUSINESS_ACTIONS: ActionDef[] = [
  { label: "Satış ekle", Icon: ArrowUpRightIcon, tint: "bg-success-soft text-success", href: (b, s) => `/sales/new?book_id=${b}&space=${s}` },
  { label: "Alış ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/purchases/new?book_id=${b}&space=${s}` },
  { label: "Masraf ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger", href: (b, s) => `/add-transaction?type=expense&business_kind=expense&book_id=${b}&space=${s}` },
  { label: "Tahsilat ekle", Icon: ClockIcon, tint: "bg-success-soft text-success", href: (_b, s) => `/debts?space=${s}&direction=receivable` },
  { label: "Ödeme ekle", Icon: ClockIcon, tint: "bg-danger-soft text-danger", href: (_b, s) => `/debts?space=${s}&direction=payable` },
  { label: "Transfer yap", Icon: TransferIcon, tint: "bg-accent-soft text-accent", href: (b, s) => `/add-transaction?type=transfer&book_id=${b}&space=${s}` },
];

/**
 * En sık kullanılacak eylemler, tek dokunuşla erişilebilir büyük
 * hedefler olarak. book_id ve space, aktif alan hangisiyse ORADAN
 * geçirilir — form ekranı Ev/İşletme arasında ASLA karışmaz.
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
  const actions = variant === "business" ? BUSINESS_ACTIONS : HOME_ACTIONS;

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(({ label, Icon, tint, href }) => (
        <Link
          key={label}
          href={href(bookId, spaceParam)}
          className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-center transition-colors active:bg-surface-muted"
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tint}`}>
            <Icon size={16} />
          </span>
          <span className="text-xs font-semibold text-text-primary">{label}</span>
        </Link>
      ))}
    </div>
  );
}
