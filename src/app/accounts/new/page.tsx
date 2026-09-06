import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "@/components/accounts/AccountForm";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ book_id?: string; space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/accounts?space=${space}` : "/accounts";

  if (!bookId) redirect(homeHref);

  // Savunma katmanı: RLS zaten üye olmayan bir defteri BOŞ döndürür.
  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  return <AccountForm bookId={bookId} homeHref={homeHref} />;
}
