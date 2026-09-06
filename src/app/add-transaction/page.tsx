import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { ArrowUpRightIcon, ArrowDownRightIcon, TransferIcon } from "@/components/icons";
import { IncomeExpenseForm } from "@/components/forms/IncomeExpenseForm";
import { TransferForm } from "@/components/forms/TransferForm";
import { getAccountsForBook, getCategoriesForBook, getUserSpacesWithAccounts } from "@/lib/dashboard/formData";

const COPY = {
  income: { title: "Gelir ekle", Icon: ArrowUpRightIcon, tint: "bg-success-soft text-success" },
  expense: { title: "Gider ekle", Icon: ArrowDownRightIcon, tint: "bg-danger-soft text-danger" },
  transfer: { title: "Transfer yap", Icon: TransferIcon, tint: "bg-accent-soft text-accent" },
} as const;

export default async function AddTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; book_id?: string; space?: string; business_kind?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    redirect("/welcome");
  }

  const { type, book_id: bookId, space, business_kind: businessKind } = await searchParams;
  const homeHref = space ? `/home?space=${space}` : "/home";

  if (!bookId) {
    redirect(homeHref);
  }

  // Savunma katmanı: book_id gerçekten var mı VE kullanıcı gerçekten
  // üyesi mi? RLS zaten bunu garanti eder (başkasının defterini SEÇ
  // eden bu sorgu BOŞ döner) — burada yalnızca "yoksa ana sayfaya dön"
  // davranışı ekleniyor.
  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) {
    redirect(homeHref);
  }

  if (type === "income" || type === "expense") {
    const [accounts, categories] = await Promise.all([
      getAccountsForBook(supabase, bookId),
      getCategoriesForBook(supabase, bookId, type),
    ]);

    return (
      <IncomeExpenseForm
        kind={type}
        bookId={bookId}
        homeHref={homeHref}
        accounts={accounts}
        categories={categories}
        businessKind={businessKind === "expense" ? "expense" : undefined}
      />
    );
  }

  if (type === "transfer") {
    const spaces = await getUserSpacesWithAccounts(supabase);
    return <TransferForm bookId={bookId} homeHref={homeHref} spaces={spaces} />;
  }

  // Tanınmayan bir type değeri gelirse (beklenmez, ama savunma amaçlı)
  // dürüst bir yer tutucu göster.
  const entry = COPY[(type as keyof typeof COPY) ?? "income"] ?? COPY.income;
  const { title, Icon, tint } = entry;

  return (
    <AppShell variant="subpage" title={title} backFallbackHref={homeHref}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full ${tint}`}>
          <Icon size={24} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Bu ekran henüz hazır değil</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
            {title} formu yakında burada olacak.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
