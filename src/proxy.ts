import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = [
  "/welcome",
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/auth/callback",
];

// update-password: kurtarma bağlantısından gelen GEÇİCİ bir oturum
// gerektirir. Bu yüzden ne "oturum yoksa /welcome'a at" ne "oturum varsa
// /'e at" kuralına tabidir — her iki middleware kuralından da muaftır,
// sayfanın kendisi geçersiz/eksik oturumu ele alır.
// /api: API route'ları KENDİ yetkilendirmesini yapar (ör. /api/cron/
// run-notifications kendi Bearer/CRON_SECRET kontrolünü uygular).
// Sayfa-seviyesi "oturum yoksa /welcome'a yönlendir" kuralı burada
// UYGULANMAMALIDIR — aksi halde oturumu olmayan harici bir zamanlayıcı
// çağrısı (hiçbir tarayıcı oturumu yok) JSON yanıtı yerine bir
// yönlendirme alır ve endpoint asla çalışmaz.
// /robots.txt, /sitemap.xml, /manifest.webmanifest: arama motoru
// tarayıcılarının ve PWA yükleme mekanizmasının HİÇBİR oturumu yoktur —
// bu rotalar da (matcher'ın negatif look-ahead'i .txt/.xml/.webmanifest
// uzantılarını KAPSAMADIĞINDAN) auth-redirect kuralına GİRERDİ ve
// /welcome'a yönlendirilirdi, bu da hiç işlev görmemesine yol açardı —
// bu yüzden açıkça muaf tutulur.
// /legal/*: yasal sayfalar (Gizlilik Politikası, Kullanım Koşulları
// vb.) hem oturum AÇIK hem oturum KAPALI kullanıcılar için erişilebilir
// olmalıdır — ne "oturum yoksa /welcome'a at" ne "oturum varsa /'e at"
// kuralına tabidir.
const AUTH_REDIRECT_EXEMPT = ["/update-password", "/api", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/legal"];

/**
 * Rota koruması: yalnızca "oturum açık mı" seviyesinde. Onboarding
 * tamamlanma durumu (alan var mı) gibi daha ince kararlar sayfa
 * seviyesinde (Server Component) veriliyor — middleware'i hafif ve
 * hızlı tutmak için (her istekte ek DB sorgusu yapmıyor).
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  const isExempt = AUTH_REDIRECT_EXEMPT.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isExempt) {
    return response;
  }

  if (!user && !isPublicPath && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
