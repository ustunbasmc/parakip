/**
 * Gerçek bir Supabase projesine karşı UÇTAN UCA doğrulama. Bu sandbox'ın
 * ağ erişimi supabase.co'ya KAPALI olduğu için bu script BURADA
 * ÇALIŞTIRILAMADI — kendi makinenizde/CI'da, migration'lar uygulandıktan
 * SONRA çalıştırın:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *     npx tsx scripts/verify-real-supabase.ts
 *
 * ÖNEMLİ — E-POSTA ADRESİ HAKKINDA: Script varsayılan olarak
 * "parakip-test-...@example.com" gibi UYDURMA adresler kullanır (RFC 2606
 * ayrılmış alan adı) — bunlar GERÇEKTEN POSTA ALAMAZ. Bu, signUp/hatalı
 * şifre/RLS gibi API DAVRANIŞLARINI test etmek için sorun değildir, ama
 * "e-posta bağlantısına gerçekten tıklama" adımını bu hesaplarla
 * TAMAMLAYAMAZSINIZ. Gerçek bir e-postayla (ör. Gmail'in + etiketleme
 * özelliğiyle sizin+testA@gmail.com) uçtan uca denemek isterseniz:
 *
 *   TEST_EMAIL_A="sizin+testA@gmail.com" TEST_EMAIL_B="sizin+testB@gmail.com" \
 *     NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *     npx tsx scripts/verify-real-supabase.ts
 *
 * NOT: Bu script GERÇEK kullanıcı hesapları oluşturur (auth.users'a kalıcı
 * satır ekler). Test sonrası Supabase Dashboard -> Authentication -> Users
 * üzerinden bu test hesaplarını silebilirsiniz (script anon key ile
 * çalıştığı için kendi kendini temizleyemez — hesap silme service_role
 * yetkisi gerektirir, kasıtlı olarak bu script'e o yetki verilmedi).
 *
 * NE TEST EDER (otomatik):
 *   - Kayıt (yeni e-posta ile signUp)
 *   - Hatalı şifre ile giriş denemesi (reddedilmeli)
 *   - Şifre sıfırlama isteği (API çağrısı başarılı olmalı — e-postanın
 *     GERÇEKTEN ulaştığını/bağlantıya tıklamayı bu script doğrulayamaz,
 *     bu İKİ adım MANUELDİR, aşağıda işaretli)
 *   - (Oturum açılabiliyorsa) tema tercihi kaydetme ve geri okuma
 *   - Ev alanı oluşturma (create_space_with_book)
 *   - İşletme alanı oluşturma (create_space_with_book)
 *   - İkinci bir test kullanıcısıyla RLS izolasyonu (birinci kullanıcının
 *     verisini göremediğini doğrulama)
 *
 * NE TEST EDEMEZ (manuel adım gerektirir, script sonunda listelenir):
 *   - E-posta doğrulama bağlantısına gerçekten tıklama
 *   - Şifre sıfırlama bağlantısına gerçekten tıklama
 *   - Google OAuth (tarayıcı + Google hesabı gerektirir)
 *   - Yetkisiz ROTA erişimi (bu, Next.js middleware/proxy.ts katmanıdır,
 *     Supabase'in değil — Adım 13'te yerel dev sunucusuna karşı curl ile
 *     zaten doğrulandı; gerçek deploy sonrası aynı testin tekrarı önerilir)
 *
 * GÜVENLİK: Bu script anon key'in KENDİSİNİ hiçbir zaman konsola yazdırmaz
 * (yalnızca proje URL'i ve test amaçlı uydurma/verilen e-posta adresleri
 * — bunların hiçbiri gizli bilgi değildir).
 *
 * NOT (Windows/Node 24 uyumluluğu): Bu script `process.exit()` YERİNE
 * `process.exitCode` kullanır — Node'un yeni sürümlerinde (özellikle
 * Windows'ta) bir ağ isteğinden hemen sonra `process.exit()` çağırmak
 * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" gibi bir libuv
 * çökmesine yol açabiliyor. Tüm kontroller `main()` içine taşınmıştır ki
 * hiçbir yerde modül-seviyesinde erken `process.exit()` olmasın.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

let pass = 0;
let fail = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

const stamp = Date.now();
// TEST_EMAIL_A/B verilirse GERÇEK bir e-posta kullanılır (e-posta
// bağlantısına gerçekten tıklama testi için); verilmezse güvenli,
// posta ALAMAYAN bir uydurma adres kullanılır (yalnızca API davranışı
// test edilir, hiçbir gerçek gelen kutusuna e-posta gönderilmeye
// ÇALIŞILMAZ diye değil — Supabase yine de göndermeyi dener ama
// example.com'a ulaşamayacağı için zararsız şekilde başarısız olur).
const userAEmail = process.env.TEST_EMAIL_A ?? `parakip-test-a-${stamp}@example.com`;
const userBEmail = process.env.TEST_EMAIL_B ?? `parakip-test-b-${stamp}@example.com`;
const usingRealEmail = Boolean(process.env.TEST_EMAIL_A);
const password = "GeciciSifre123!";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL ve/veya NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil.");
    process.exitCode = 1;
    return;
  }

  console.log(`Proje: ${url}`);
  console.log(`Test kullanıcısı A: ${userAEmail}`);
  console.log(`Test kullanıcısı B: ${userBEmail}`);
  console.log(
    usingRealEmail
      ? "ℹ️  Gerçek e-posta kullanılıyor — onay/sıfırlama bağlantılarına gerçekten tıklayabilirsiniz."
      : "ℹ️  Uydurma (@example.com) e-posta kullanılıyor — yalnızca API davranışı test edilir, gerçek e-posta ULAŞMAZ."
  );
  console.log("");

  const clientA = createClient(url!, anonKey!);
  const clientB = createClient(url!, anonKey!);

  // ── 1. KAYIT ──────────────────────────────────────────────
  console.log("### 1) Kayıt (signUp) ###");
  const signUpResult = await clientA.auth.signUp({ email: userAEmail, password });
  report("signUp hatasız tamamlandı", !signUpResult.error, signUpResult.error?.message);

  const hasImmediateSession = Boolean(signUpResult.data.session);
  console.log(
    hasImmediateSession
      ? "ℹ️  Proje e-posta onayını KAPALI tutuyor — oturum hemen açıldı."
      : "ℹ️  Proje e-posta onayını AÇIK tutuyor — oturum yok, MANUEL onay gerekecek (aşağıya bakın)."
  );

  // ── 2. HATALI ŞİFRE ───────────────────────────────────────
  console.log("");
  console.log("### 2) Hatalı şifre ile giriş denemesi ###");
  const wrongPasswordResult = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: "kesinlikle-yanlis-sifre",
  });
  report(
    "Hatalı şifre reddedildi",
    Boolean(wrongPasswordResult.error),
    wrongPasswordResult.error?.message
  );

  // ── 3. ŞİFRE SIFIRLAMA İSTEĞİ (yalnızca API çağrısı) ─────
  console.log("");
  console.log("### 3) Şifre sıfırlama isteği (API çağrısı) ###");
  const resetResult = await clientA.auth.resetPasswordForEmail(userAEmail);
  report("resetPasswordForEmail hatasız kabul edildi", !resetResult.error, resetResult.error?.message);
  console.log("   ⚠️  MANUEL: gelen kutusunu kontrol edip bağlantıya tıklayarak tamamla.");

  // ── OTURUM GEREKTİREN TESTLER ─────────────────────────────
  let session = signUpResult.data.session;

  if (!session) {
    console.log("");
    console.log("ℹ️  E-posta onayı açık olduğu için oturum yok — doğrudan giriş deneniyor");
    console.log("   (bazı projelerde onaysız girişe izin verilmeyebilir, bu normaldir).");
    const signInAttempt = await clientA.auth.signInWithPassword({ email: userAEmail, password });
    session = signInAttempt.data.session;
  }

  if (!session) {
    console.log("");
    console.log("⚠️  Oturum açılamadı (e-posta onayı bekleniyor) — 4-7 arası testler ATLANDI.");
    console.log("   E-postadaki onay bağlantısına tıkladıktan sonra bu script'i tekrar çalıştırın.");
  } else {
    // ── 4. TEMA TERCİHİ ─────────────────────────────────────
    console.log("");
    console.log("### 4) Tema tercihi kaydetme ve geri okuma ###");
    const userId = session.user.id;
    const { error: themeUpdateError } = await clientA
      .from("profiles")
      .update({ theme_preference: "dark" })
      .eq("user_id", userId);
    report("theme_preference='dark' güncellendi", !themeUpdateError, themeUpdateError?.message);

    const { data: themeReadBack, error: themeReadError } = await clientA
      .from("profiles")
      .select("theme_preference")
      .eq("user_id", userId)
      .single();
    report(
      "Kaydedilen tema geri okundu ve eşleşiyor",
      !themeReadError && themeReadBack?.theme_preference === "dark",
      themeReadError?.message
    );

    // ── 5. EV ALANI OLUŞTURMA ───────────────────────────────
    console.log("");
    console.log("### 5) Ev alanı oluşturma ###");
    const homeResult = await clientA
      .rpc("create_space_with_book", { p_type: "home", p_name: "Test Ev" })
      .single<{ space_id: string; book_id: string }>();
    report(
      "create_space_with_book('home') başarılı, defter oluştu",
      !homeResult.error && Boolean(homeResult.data?.book_id),
      homeResult.error?.message
    );

    // ── 6. İŞLETME ALANI OLUŞTURMA ──────────────────────────
    console.log("");
    console.log("### 6) İşletme alanı oluşturma ###");
    const businessResult = await clientA
      .rpc("create_space_with_book", { p_type: "business", p_name: "Test İşletmem" })
      .single<{ space_id: string; book_id: string }>();
    report(
      "create_space_with_book('business') başarılı, defter oluştu",
      !businessResult.error && Boolean(businessResult.data?.book_id),
      businessResult.error?.message
    );

    // ── AYNI KULLANICI İKİNCİ EV ALANI DENEMESİ (regresyon) ─
    console.log("");
    console.log("### 6b) Aynı kullanıcı ikinci bir Ev alanı açmaya çalışıyor (reddedilmeli) ###");
    const secondHomeResult = await clientA.rpc("create_space_with_book", {
      p_type: "home",
      p_name: "İkinci Ev Denemesi",
    });
    report(
      "İkinci Ev alanı reddedildi (spaces_one_home_per_user)",
      Boolean(secondHomeResult.error),
      secondHomeResult.error?.message
    );

    // ── 7. RLS İZOLASYONU ────────────────────────────────────
    console.log("");
    console.log("### 7) RLS izolasyonu (ikinci kullanıcı, birinci kullanıcının verisini göremiyor) ###");
    await clientB.auth.signUp({ email: userBEmail, password });
    const bSignIn = await clientB.auth.signInWithPassword({ email: userBEmail, password });

    if (!bSignIn.data.session) {
      console.log("⚠️  Kullanıcı B için de e-posta onayı bekleniyor — RLS testi ATLANDI.");
    } else {
      const { data: leakedSpaces, error: leakError } = await clientB
        .from("spaces")
        .select("id")
        .eq("id", homeResult.data?.space_id ?? "");
      report(
        "Kullanıcı B, kullanıcı A'nın Ev alanını GÖREMİYOR",
        !leakError && (leakedSpaces?.length ?? 0) === 0,
        leakError?.message
      );
    }
  }

  console.log("");
  console.log(`SONUÇ: ${pass} geçti, ${fail} başarısız`);
  console.log("");
  console.log("── MANUEL DOĞRULANMASI GEREKEN ADIMLAR ──");
  if (!usingRealEmail) {
    console.log(
      "0. Bu çalıştırma uydurma e-posta kullandı; e-posta bağlantısı adımlarını GERÇEK bir"
    );
    console.log(
      "   adresle tekrar çalıştırın: TEST_EMAIL_A=... TEST_EMAIL_B=... npx tsx scripts/verify-real-supabase.ts"
    );
  }
  console.log("1. Kayıt e-postasındaki onay bağlantısına tıkla, ardından giriş yapabildiğini doğrula.");
  console.log("2. Şifre sıfırlama e-postasındaki bağlantıya tıkla, /update-password ekranının açıldığını doğrula.");
  console.log("3. Supabase Dashboard -> Authentication -> Providers -> Google'ı etkinleştirip");
  console.log("   gerçek bir Google hesabıyla /sign-in ekranından 'Google ile devam et'i dene.");
  console.log("4. Gerçek dağıtım (Vercel vb.) sonrası /home, /onboarding/*, /settings/theme'e");
  console.log("   oturum açmadan gitmeyi deneyip /welcome'a yönlendirildiğini doğrula.");
  console.log("5. (İsteğe bağlı temizlik) Supabase Dashboard -> Authentication -> Users'dan");
  console.log("   bu script'in oluşturduğu test hesaplarını silebilirsin.");

  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("❌ Beklenmeyen hata:", err);
  process.exitCode = 1;
});
