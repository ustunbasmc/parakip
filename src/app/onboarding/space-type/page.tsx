import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getUserSpacesBasic } from "@/lib/dashboard/formData";
import { parsePlanKey, parseSpaceType, planSpaceType } from "@/lib/plans/planParam";
import { SpaceTypeChooser } from "@/components/onboarding/SpaceTypeChooser";

/**
 * "Nasıl kullanacaksın?" Tanıtım sayfasından plan (?plan=) veya alan türü
 * (?type=) seçilerek gelindiyse soru atlanır:
 *   - O türde alanı zaten varsa: plan seçildiyse ödeme ekranına, yoksa alana.
 *   - Yoksa: o türde alan kurulumuna (plan adreste taşınır).
 */
export default async function SpaceTypePage({ searchParams }: { searchParams: Promise<{ plan?: string; type?: string }> }) {
  const params = await searchParams;
  const plan = parsePlanKey(params.plan);
  const type = plan ? planSpaceType(plan) : parseSpaceType(params.type);

  if (type) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    if (!user) redirect("/welcome");
    const existing = (await getUserSpacesBasic(supabase)).find((s) => s.type === type);
    if (existing) {
      redirect(plan ? `/settings/plan?space=${existing.id}&plan=${plan}` : `/home?space=${existing.id}`);
    }
    redirect(`/onboarding/create-space?type=${type}${plan ? `&plan=${plan}` : ""}`);
  }

  return <SpaceTypeChooser />;
}
