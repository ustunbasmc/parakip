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
