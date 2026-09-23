import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware.ts (proxy.ts) içinden çağrılır. İki iş yapar:
 * (1) oturum cookie'sini tazeler, (2) çağırana kullanıcının oturum açık
 * olup olmadığını döner — böylece proxy.ts basit bir "korumalı rota mı"
 * yönlendirmesi yapabilir. ASIL yetki kararı (kim neyi görebilir/
 * değiştirebilir) burada DEĞİL, RLS ve sunucu tarafı fonksiyonlarda
 * verilir; buradaki kontrol yalnızca "oturum açık mı" düzeyinde bir
 * kullanıcı deneyimi yönlendirmesidir.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Supabase'e erişilemezse (ağ hatası, servis kesintisi) FAIL-CLOSED
  // davranılır: kullanıcı "oturum yok" kabul edilir (500 hatasıyla tüm
  // siteyi çökertmek yerine /welcome'a yönlendirilir). Bu, gerçek bir
  // güvenlik kararı değil yalnızca kullanıcı deneyimi/dayanıklılık
  // önlemidir — asıl yetki RLS'te.
  //
  // PERFORMANS: getUser() her istekte Supabase Auth sunucusuna ağ isteği
  // atar; sayfa (Server Component) zaten kendi getUser() doğrulamasını
  // yaptığından bu, her geçişte ÇİFT tur demekti. getClaims() JWT'yi
  // asimetrik imzalama anahtarlarıyla YEREL olarak doğrular (JWKS
  // önbelleklenir); proje hâlâ simetrik (HS256) anahtar kullanıyorsa
  // kütüphane otomatik olarak getUser()'a düşer — yani güvenlik
  // gevşemez, yalnızca mümkün olduğunda ağ turu kalkar. Süresi dolmuş
  // oturum yine burada yenilenir (cookie setAll).
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  return { response, user };
}
