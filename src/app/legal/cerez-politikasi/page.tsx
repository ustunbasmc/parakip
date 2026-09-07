import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = { title: "Çerez Politikası | Parakip" };

/** ⚠️ TASLAK — yayına almadan önce gözden geçirilmelidir. */
export default function CookiePolicyPage() {
  return (
    <LegalPageShell title="Çerez Politikası" lastUpdated="[TARİH GİRİLECEK]">
      <p>
        Parakip, oturumunuzu açık tutmak ve tercihlerinizi (ör. açık/koyu tema) hatırlamak için sınırlı
        sayıda çerez ve benzeri teknoloji (yerel depolama) kullanır.
      </p>

      <section>
        <h2 className="text-lg font-bold text-text-primary">1. Kullandığımız Çerez Türleri</h2>
        <ul className="ml-5 mt-1 list-disc">
          <li>
            <strong>Zorunlu çerezler:</strong> Oturum açmanızı ve güvenli kalmanızı sağlayan, Supabase Auth
            tarafından yönetilen oturum çerezleri. Bunlar olmadan uygulama çalışamaz.
          </li>
          <li>
            <strong>Tercih depolaması:</strong> Tema (açık/koyu) tercihiniz gibi ayarlar, tarayıcınızın
            yerel depolamasında (cookie DEĞİL, localStorage benzeri bir mekanizma) tutulur.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">2. Reklam/Analitik Çerezleri</h2>
        <p>Parakip, şu anda üçüncü taraf reklam veya analitik izleme çerezi KULLANMAMAKTADIR.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary">3. Çerezleri Yönetme</h2>
        <p>Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz — ancak zorunlu oturum
          çerezlerini engellemeniz halinde uygulamaya giriş yapamayabilirsiniz.</p>
      </section>
    </LegalPageShell>
  );
}
