import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartyForm } from "@/components/parties/PartyForm";

export default async function NewSupplierPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { space } = await searchParams;
  const homeHref = space ? `/suppliers?space=${space}` : "/suppliers";
  if (!space) redirect(homeHref);

  const { data: spaceRow } = await supabase.from("spaces").select("id, type").eq("id", space).maybeSingle();
  if (!spaceRow || spaceRow.type !== "business") redirect("/home");

  return <PartyForm type="supplier" spaceId={space} homeHref={homeHref} />;
}
