import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupportTicketForm } from "@/components/support/SupportTicketForm";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { isTicketType, matchScreen, SUBJECT_MAX } from "@/lib/support/constants";

export const metadata = { title: "Destek talebi oluştur | Parakip" };

export default async function NewSupportTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; article?: string; from?: string; space?: string; subject?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const params = await searchParams;

  // Alan TÜRÜ yalnızca ön seçim içindir; alan kimliği talebe YAZILMAZ.
  const spaces = await getUserSpacesBasic(supabase).catch(() => []);
  const activeSpace = spaces.length > 0 ? resolveActiveSpace(spaces, params.space) : null;

  let relatedArticle: { slug: string; title: string } | null = null;
  if (params.article && /^[a-z0-9-]{1,120}$/.test(params.article)) {
    const { data } = await supabase
      .from("help_articles")
      .select("slug, title")
      .eq("slug", params.article)
      .eq("status", "published")
      .maybeSingle();
    relatedArticle = data ?? null;
  }

  const initialSubject = relatedArticle
    ? `Yardım: ${relatedArticle.title}`.slice(0, SUBJECT_MAX)
    : (params.subject ?? "").slice(0, SUBJECT_MAX);

  return (
    <SupportTicketForm
      userId={user.id}
      initialType={isTicketType(params.type) ? params.type : ""}
      initialSubject={initialSubject}
      initialScreen={matchScreen(params.from)}
      initialSpaceType={activeSpace?.type ?? null}
      relatedArticle={relatedArticle}
      activeSpaceType={activeSpace?.type}
    />
  );
}
