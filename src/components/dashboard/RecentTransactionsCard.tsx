import type { ComponentType } from "react";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatRelativeDate } from "@/lib/format/date";
import type { RecentTransactionRow } from "@/lib/dashboard/queries";
import { ArrowUpRightIcon, ArrowDownRightIcon, TransferIcon } from "@/components/icons";
import { CardEmptyState } from "./DashboardCard";

const TYPE_LABEL: Record<RecentTransactionRow["type"], string> = {
  income: "Gelir",
  expense: "Gider",
  transfer: "Transfer",
};

const TYPE_ICON: Record<RecentTransactionRow["type"], ComponentType<{ size?: number; className?: string }>> = {
  income: ArrowUpRightIcon,
  expense: ArrowDownRightIcon,
  transfer: TransferIcon,
};

const TYPE_TINT: Record<RecentTransactionRow["type"], string> = {
  income: "bg-success-soft text-success",
  expense: "bg-danger-soft text-danger",
  transfer: "bg-accent-soft text-accent",
};

/**
 * "Okunaklı, kaydırılabilir liste": dikey akışta zaten kaydırılabilir
 * (uzun listelerde AppShell'in ana içerik kaydırması devreye girer);
 * her satır tür ikonuyla anında taranabilir.
 */
export function RecentTransactionsList({ items }: { items: RecentTransactionRow[] }) {
  if (items.length === 0) {
    return (
      <CardEmptyState
        message="Henüz işlem eklenmedi."
        hint="İlk gelir veya gider kaydını hızlı işlemlerden ekleyebilirsin."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => {
        const isPositive = item.amountCents > 0;
        const Icon = TYPE_ICON[item.type];
        return (
          <li key={item.entryId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_TINT[item.type]}`}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {item.note || TYPE_LABEL[item.type]}
              </p>
              <p className="truncate text-xs text-text-muted">
                {item.accountName ?? TYPE_LABEL[item.type]} · {formatRelativeDate(item.occurredAt)}
              </p>
            </div>
            <p
              className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${
                item.type === "transfer" ? "text-text-primary" : isPositive ? "text-success" : "text-danger"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatCentsAsCurrency(item.amountCents, item.currency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
