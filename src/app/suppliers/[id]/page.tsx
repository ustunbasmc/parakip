import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartyDetailView } from "@/components/parties/PartyDetailView";
import { getSupplierDetail } from "@/lib/dashboard/customers";

export default async function SupplierDetailPage({
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
  const backHref = space ? `/suppliers?space=${space}` : "/suppliers";

  const supplier = await getSupplierDetail(supabase, id);
  if (!supplier) notFound();

  return <PartyDetailView type="supplier" party={supplier} spaceParam={space ?? ""} backHref={backHref} />;
}
