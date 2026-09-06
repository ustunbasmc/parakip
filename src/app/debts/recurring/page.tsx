import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";
import { RecurringRuleListItem } from "@/components/debts/RecurringRuleListItem";
import { PlusIcon } from "@/components/icons";
import { getUserSpacesBasic, resolveActiveSpace, getUserRoleForBook } from "@/lib/dashboard/formData";
import { getRecurringPaymentRules } from "@/lib/dashboard/debts";

export default async function RecurringRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  const backHref = `/debts?space=${activeSpace.id}`;

  let rules: Awaited<ReturnType<typeof getRecurringPaymentRules>>;
  let loadError = false;
  try {
    rules = await getRecurringPaymentRules(supabase, activeSpace.bookId);
  } catch {
    loadError = true;
    rules = [];
  }

  const role = await getUserRoleForBook(supabase, activeSpace.bookId);
  const canManage = role === "owner" || role === "admin";

  return (
    <AppShell variant="subpage" title="Tekrarlayan ödemeler" backFallbackHref={backHref}>
      <div className="flex flex-col gap-3 pt-3 pb-4">
        <div className="flex justify-end">
          <Link
            href={`/debts/recurring/new?book_id=${activeSpace.bookId}&space=${activeSpace.id}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-text-on-accent"
            aria-label="Yeni tekrarlayan ödeme ekle"
          >
            <PlusIcon size={18} />
          </Link>
        </div>

        {loadError ? (
          <p className="py-6 text-center text-sm text-danger">Kurallar yüklenemedi. Lütfen tekrar dene.</p>
        ) : rules.length === 0 ? (
          <CardEmptyState
            message="Henüz tekrarlayan ödeme kuralı yok."
            hint="Kira, fatura gibi düzenli ödemeler için + ile ekleyebilirsin."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <RecurringRuleListItem key={r.id} rule={r} canManage={canManage} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
