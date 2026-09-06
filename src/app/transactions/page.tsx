import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import {
  getAllAccountsForBook,
  getAllCategoriesForBook,
  getUserSpacesBasic,
  resolveActiveSpace,
} from "@/lib/dashboard/formData";
import {
  getTransactionHistory,
  type TransactionKindFilter,
  type StatusFilter,
} from "@/lib/dashboard/transactionHistory";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

const VALID_KINDS = new Set(["all", "income", "expense", "transfer", "investment"]);
const VALID_STATUSES = new Set(["active", "cancelled", "all"]);

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const profileHeader = await getProfileHeaderInfo(supabase, user.id);

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/transactions?space=${activeSpace.id}`);
  }

  const kind = (VALID_KINDS.has(params.kind ?? "") ? params.kind : "all") as TransactionKindFilter;
  const status = (VALID_STATUSES.has(params.status ?? "") ? params.status : "active") as StatusFilter;

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(supabase);
  } catch {
    unreadCount = 0;
  }

  const [accounts, categories] = await Promise.all([
    getAllAccountsForBook(supabase, activeSpace.bookId),
    getAllCategoriesForBook(supabase, activeSpace.bookId),
  ]);

  let rows: Awaited<ReturnType<typeof getTransactionHistory>>["rows"];
  let hasMore = false;
  let loadError = false;
  try {
    const result = await getTransactionHistory(supabase, activeSpace.bookId, {
      kind,
      status,
      accountId: params.account || undefined,
      categoryId: params.category || undefined,
      dateFrom: params.from || undefined,
      dateTo: params.to || undefined,
      search: params.q || undefined,
    });
    rows = result.rows;
    hasMore = result.hasMore;
  } catch {
    loadError = true;
    rows = [];
  }

  const hasActiveFilters = Boolean(
    params.account || params.category || params.from || params.to || params.q || kind !== "all" || status !== "active"
  );

  return (
    <AppShell
      activeSpaceType={activeSpace.type}
      title="Hareketler"
      headerEnd={
        <div className="flex items-center gap-2">
          <NotificationBell unreadCount={unreadCount} />
          <SpaceSwitcher
            options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))}
            activeId={activeSpace.id}
          />
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <TransactionFilters accounts={accounts} categories={categories} />
          </div>
          <ExportCsvButton
            headers={["Tarih", "Tutar", "Para birimi", "İşlem türü", "Hesap", "Kategori", "Açıklama", "Durum"]}
            rows={rows.map((row) => [
              new Date(row.occurredAt).toLocaleString("tr-TR"),
              (row.amountCents / 100).toFixed(2).replace(".", ","),
              row.currency,
              row.creditDebtId
                ? `${row.businessKind === "purchase" ? "Alış" : "Satış"} (veresiye)`
                : row.businessKind === "sale"
                  ? "Satış"
                  : row.businessKind === "purchase"
                    ? "Alış"
                    : row.businessKind === "expense"
                      ? "Masraf"
                      : row.type === "income"
                        ? "Gelir"
                        : row.type === "expense"
                          ? "Gider"
                          : "Transfer",
              row.creditDebtId ? "—" : row.accountName,
              row.categoryName ?? "",
              row.note ?? "",
              row.creditDebtId ? "Tahsil edilecek" : row.status === "cancelled" ? "İptal edildi" : "Aktif",
            ])}
            filename={`islem-gecmisi-${activeSpace.id}.csv`}
          />
        </div>

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">İşlemler yüklenemedi. Lütfen tekrar dene.</p>
        ) : rows.length === 0 ? (
          <CardEmptyState
            message={hasActiveFilters ? "Bu filtrelere uyan işlem bulunamadı." : "Henüz işlem eklenmedi."}
            hint={hasActiveFilters ? "Filtreleri değiştirmeyi dene." : "İlk kaydını ana sayfadaki hızlı işlemlerden ekleyebilirsin."}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <TransactionListItem key={row.entryId} row={row} spaceParam={activeSpace.id} />
            ))}
          </div>
        )}

        {hasMore ? <p className="py-2 text-center text-xs text-text-muted">Daha fazla işlem var — tarih aralığını daraltarak filtreleyebilirsin.</p> : null}
      </div>
    </AppShell>
  );
}
