import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/LandingPage";

/**
 * Oturum açmamış ziyaretçiler için SEO'ya uygun tanıtım sayfası (bkz.
 * LandingPage). Oturum açmış kullanıcılar için kök rota HİÇBİR arayüz
 * göstermez, doğrudan yönlendirir:
 *   alan yok  -> /onboarding/space-type
 *   alan var  -> /home
 */
export const metadata: Metadata = {
  title: "Parakip — Ev ve İşletme Finansını Tek Yerden Yönet",
  description:
    "Parakip ile Ev ve İşletme finansını tek yerden yönet: gelir-gider takibi, borç ve alacaklar, tekrarlayan ödemeler, bütçe yönetimi ve yatırım portföyü. Ücretsiz başla.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Parakip — Paran kontrolünde.",
    description:
      "Ev ve İşletme finansını tek yerden yönet: gelir-gider, borç-alacak, bütçe ve yatırım takibi.",
    url: "/",
    siteName: "Parakip",
    locale: "tr_TR",
    type: "website",
  },
};

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    return <LandingPage />;
  }

  const { count } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true });

  if (!count || count === 0) {
    redirect("/onboarding/space-type");
  }

  redirect("/home");
}
