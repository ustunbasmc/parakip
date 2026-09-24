import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { PlusIcon } from "@/components/icons";
import { RecurringTxRuleItem } from "@/components/transactions/RecurringTxRuleItem";
import { getUserRoleForBook, getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getRecurringTxRules } from "@/lib/dashboard/recurringTransactions";

export default async function RecurringTransactionsPage({ searchParams }: { searchParams: Promise<{ space?: string; created?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");
  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);

  const [rulesResult, role] = await Promise.all([
    getRecurringTxRules(supabase, activeSpace.bookId)
      .then((rules) => ({ rules, error: false }))
      .catch(() => ({ rules: [], error: true })),
    getUserRoleForBook(supabase, activeSpace.bookId).catch(() => null),
  ]);
  const canCreate = role === "owner" || role === "admin" || role === "editor";
  const isManager = role === "owner" || role === "admin";
  const newHref = `/transactions/recurring/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}`;

  return (
    <AppShell variant="subpage" title="Tekrarlayan kayıtlar" parentHref={`/transactions?space=${activeSpace.id}`} helpSlug="tekrarlayan-gelir-gider">
      <div className="flex flex-col gap-3 pt-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">Maaş, kira, abonelik gibi düzenli kayıtlar vadesi gelince otomatik eklenir.</p>
          {canCreate ? (
            <Link href={newHref} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent" aria-label="Yeni kural">
              <PlusIcon size={18} />
            </Link>
          ) : null}
        </div>

        {params.created ? (
          <p role="status" className="rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            Kural oluşturuldu ve vadesi bugün olduğu için ilk kayıt hemen eklendi.
          </p>
        ) : null}

        {rulesResult.error ? (
          <p className="py-6 text-center text-sm text-danger">Kurallar yüklenemedi. Lütfen tekrar dene.</p>
        ) : rulesResult.rules.length === 0 ? (
          <div className="surface-card rounded-3xl p-2">
            <CardEmptyState
              message="Henüz tekrarlayan kayıt yok."
              hint="Her ay maaşını veya aboneliklerini elle girmek yerine bir kez kural oluştur."
              action={canCreate ? { href: newHref, label: "İlk kuralı oluştur" } : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rulesResult.rules.map((r) => (
              <RecurringTxRuleItem key={r.id} rule={r} canToggle={isManager || (canCreate && r.createdBy === user.id)} />
            ))}
          </div>
        )}

        <p className="px-1 text-xs text-text-muted">
          Borç/alacak kaydı üreten kurallar (ör. ödenmesi gereken kira) için{" "}
          <Link href={`/debts/recurring?space=${activeSpace.id}`} className="font-semibold text-accent">
            Borçlar → Tekrarlayan ödemeler
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
