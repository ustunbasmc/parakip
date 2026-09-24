import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safeNext";
import { parseSignupSource } from "@/lib/marketing/attribution";

/**
 * Hem Google OAuth hem e-posta onay/şifre sıfırlama bağlantılarının
 * ortak dönüş noktası. Supabase, bir "code" query parametresiyle buraya
 * yönlendirir; bu kod bir oturuma değiştirilir (PKCE akışı).
 * ?next= ile şifre sıfırlama gibi özel hedeflere yönlendirme desteklenir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Yalnızca uygulama içi yol (açık yönlendirmeye karşı, bkz. safeNext).
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google ile kayıtta kayıt kaynağı (tanıtım sayfası/kampanya) burada
      // bir kez yazılır; e-posta ile kayıtta zaten signUp sırasında yazılmıştır.
      const source = parseSignupSource(searchParams);
      if (source && data.user && !data.user.user_metadata?.signup_source) {
        await supabase.auth.updateUser({ data: { signup_source: source } }).catch(() => undefined);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
