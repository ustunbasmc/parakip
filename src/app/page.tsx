import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/LandingPage";
import { parseSignupSource } from "@/lib/marketing/attribution";

/**
 * Oturum açmamış ziyaretçiler için SEO'ya uygun tanıtım sayfası (bkz.
 * LandingPage). Oturum açmış kullanıcılar için kök rota HİÇBİR arayüz
 * göstermez, doğrudan yönlendirir:
 *   alan yok  -> /onboarding/space-type
 *   alan var  -> /home
 */
export const metadata: Metadata = {
  title: "Parakip — Paranın nereye gittiğini ilk ay gör",
  description:
    "Ücretsiz gelir-gider, bütçe, borç-alacak ve birikim takibi. Ev bütçeni ve işletmeni tek yerden yönet, her ay sade bir özet al. Kart gerekmez.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Parakip — Paranın nereye gittiğini ilk ay gör",
    description: "Ücretsiz gelir-gider, bütçe, borç-alacak ve birikim takibi. Ev ve işletme için tek uygulama.",
    url: "/",
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

export default async function RootPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    return <LandingPage utm={parseSignupSource(await searchParams)} />;
  }

  const { count } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true });

  if (!count || count === 0) {
    redirect("/onboarding/space-type");
  }

  redirect("/home");
}
