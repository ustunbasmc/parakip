import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Hem Google OAuth hem e-posta onay/şifre sıfırlama bağlantılarının
 * ortak dönüş noktası. Supabase, bir "code" query parametresiyle buraya
 * yönlendirir; bu kod bir oturuma değiştirilir (PKCE akışı).
 * ?next= ile şifre sıfırlama gibi özel hedeflere yönlendirme desteklenir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
