import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action / Route Handler içinde kullanılır.
 * Kullanıcının oturum bilgisini cookie üzerinden okur; RLS bu client
 * ile yapılan sorgularda normal şekilde uygulanır (auth.uid() dolu gelir).
 *
 * GÜVENLİK NOTU: Bu client hâlâ anon key kullanır ve RLS'e tabidir.
 * RLS'i bilerek bypass etmesi gereken (ör. audit_log yazımı, cross-book
 * transfer/iptal yetki kontrolü) işlemler için service-role client
 * AYRI bir dosyada (server-admin.ts, ileride eklenecek) tanımlanmalı ve
 * yalnızca gerekçelendirilmiş, dar kapsamlı sunucu fonksiyonlarında
 * kullanılmalıdır — bu dosyada değil.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden çağrıldığında cookie set edilemez;
            // middleware zaten oturum yenilemesini ayrıca yapıyor, bu yüzden
            // burada sessizce yutulması güvenlidir.
          }
        },
      },
    }
  );
}

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Sayfalar (Server Component) için oturum sahibini döndürür.
 *
 * PERFORMANS: getUser() her çağrıda Supabase Auth sunucusuna ağ isteği
 * atar. getClaims() ise JWT'yi projenin asimetrik (ES256) imzalama
 * anahtarıyla YEREL doğrular (JWKS önbelleklenir) — her sayfa açılışından
 * bir ağ turu kalkar. İmza doğrulanmadan claim döndürülmez; simetrik
 * anahtara geçilirse kütüphane kendiliğinden getUser()'a düşer.
 *
 * SINIR: Yerel doğrulama, token süresi (varsayılan 1 saat) dolana kadar
 * askıya alınmış bir hesabı fark etmez; yenileme (refresh) ise reddedilir.
 * Bu yüzden ödeme, admin ve yazma işlemleri (server action / route)
 * getUser() ile tam doğrulamaya devam eder — bu yardımcı yalnızca sayfa
 * render'ı içindir. Veri erişimi her durumda RLS ile korunur.
 */
export async function getSessionUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
