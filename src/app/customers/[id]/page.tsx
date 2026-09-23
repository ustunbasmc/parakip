import { redirect, notFound } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PartyDetailView } from "@/components/parties/PartyDetailView";
import { getCustomerDetail } from "@/lib/dashboard/customers";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { id } = await params;
  const { space } = await searchParams;
  const backHref = space ? `/customers?space=${space}` : "/customers";

  const customer = await getCustomerDetail(supabase, id);
  if (!customer) notFound();

  return <PartyDetailView type="customer" party={customer} spaceParam={space ?? ""} backHref={backHref} />;
}
