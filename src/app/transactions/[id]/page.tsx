import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { ArrowUpRightIcon, ArrowDownRightIcon, TransferIcon, TrendingUpIcon, LockIcon } from "@/components/icons";
import { getTransactionEntryDetail } from "@/lib/dashboard/transactionHistory";
import { transferDirectionLabel } from "@/components/transactions/TransactionListItem";

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

function formatFullDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { id } = await params;
  const { space } = await searchParams;
  const backHref = space ? `/transactions?space=${space}` : "/transactions";

  const detail = await getTransactionEntryDetail(supabase, id);
  if (!detail) notFound(); // RLS erisimi olmayan (ör. cross-book karsi taraf) icin de bunu dondurur

  const Icon = detail.isInvestment ? TrendingUpIcon : TYPE_ICON[detail.type];
  const isCancelled = detail.status === "cancelled";
  const isTransfer = detail.type === "transfer";
  const isPositive = !isTransfer && detail.amountCents > 0;

  return (
    <AppShell variant="subpage" title="İşlem detayı" backFallbackHref={backHref}>
      <div className="flex flex-col gap-5 pt-3 pb-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <span className={`flex h-14 w-14 items-center justify-center rounded-full ${TYPE_TINT[detail.type]}`}>
            <Icon size={24} />
          </span>
          <p
            className={`text-3xl font-extrabold tabular-nums ${
              isCancelled ? "text-text-muted line-through" : isTransfer ? "text-text-primary" : isPositive ? "text-success" : "text-danger"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatCentsAsCurrency(detail.amountCents, detail.currency)}
          </p>
          {isTransfer && detail.transfer ? (
            <p className="text-sm font-semibold text-text-primary">{transferDirectionLabel(detail.transfer)}</p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-muted">
              {detail.isInvestment ? "Yatırım" : TYPE_LABEL[detail.type]}
            </span>
            {isCancelled ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-text-muted">
                İptal edildi
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          {isTransfer ? (
            <>
              <DetailRow label="Kaynak" value={detail.transfer?.fromAccountName ?? "Başka bir alan"} />
              <DetailRow label="Hedef" value={detail.transfer?.toAccountName ?? "Başka bir alan"} />
            </>
          ) : (
            <DetailRow label="Hesap" value={detail.accountName} />
          )}
          <DetailRow label="Kategori" value={detail.categoryName ?? "Kategorisiz"} />
          <DetailRow label="Tarih" value={formatFullDate(detail.occurredAt)} />
          {detail.note ? <DetailRow label="Açıklama" value={detail.note} /> : null}
          <DetailRow label="Oluşturulma" value={formatFullDate(detail.createdAt)} />
          {detail.cancelledAt ? (
            <DetailRow label="İptal tarihi" value={formatFullDate(detail.cancelledAt)} />
          ) : null}
        </div>

        {isTransfer && detail.transfer?.crossBook && (!detail.transfer.fromAccountName || !detail.transfer.toAccountName) ? (
          <p className="text-center text-xs text-text-muted">
            Bu transferin karşı tarafı, üyesi olmadığın başka bir alana ait olduğu için ayrıntıları gösterilmiyor.
          </p>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
          <LockIcon size={14} className="mt-0.5 shrink-0" />
          <p>
            Finansal kayıtlar hiçbir zaman fiziksel olarak silinmez. Yanlış girilen bir işlem varsa yetkili bir
            kullanıcı bu kaydı iptal edebilir — iptal edilen işlemler geçmişte &ldquo;İptal&rdquo; etiketiyle
            görünmeye devam eder.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-3.5 last:pb-3.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}
