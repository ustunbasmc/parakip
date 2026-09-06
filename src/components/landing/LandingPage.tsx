import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  WalletIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ClockIcon,
  PieChartIcon,
  TrendingUpIcon,
  SparkleIcon,
  ShieldIcon,
  BuildingIcon,
  CheckIcon,
} from "@/components/icons";

const FEATURES: { icon: typeof WalletIcon; title: string; description: string; comingSoon?: boolean }[] = [
  { icon: ArrowUpRightIcon, title: "Gelir-gider", description: "Her hesaptaki hareketi kategorilere ayırarak anlık izle." },
  { icon: WalletIcon, title: "Hesaplar", description: "Nakit, banka, kredi kartı ve yatırım hesaplarını tek yerde topla." },
  { icon: ArrowDownRightIcon, title: "Borçlar ve tahsilatlar", description: "Kime borçlusun, kimden alacaklısın — vade takibiyle birlikte." },
  { icon: ClockIcon, title: "Planlı ödemeler", description: "Kira, fatura gibi tekrarlayan ödemeler için otomatik kural tanımla." },
  { icon: PieChartIcon, title: "Bütçeler", description: "Aylık bütçe belirle, harcamanın yüzde kaçını kullandığını her an gör." },
  { icon: TrendingUpIcon, title: "Yatırım portföyü", description: "Alım-satım hareketlerini ve maliyet bazlı getirini takip et." },
  { icon: BuildingIcon, title: "Raporlar", description: "Kategori, hesap ve aylık karşılaştırmalı finansal analizler." },
  { icon: SparkleIcon, title: "Yapay zekâ içgörüleri", description: "Harcama alışkanlıklarına dair akıllı öneriler.", comingSoon: true },
];

const NAV_LINKS = [
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#ev-icin", label: "Ev için" },
  { href: "#isletmeler-icin", label: "İşletmeler için" },
  { href: "#fiyatlandirma", label: "Fiyatlandırma" },
];

/**
 * Oturum açmamış ziyaretçiler için SEO'ya uygun, profesyonel tanıtım
 * sayfası. Sunucu bileşenidir (etkileşim gerektirmez, arama motorları
 * tam içeriği görebilir; anchor linkler dışında JS gerekmez). Yalnızca
 * GERÇEKTEN VAR OLAN özellikler anlatılır — "Yapay zekâ" ve ücretli
 * abonelik açıkça "yakında" olarak işaretlenir (henüz gerçek bir ödeme
 * altyapısı yok). Renkler tamamen mevcut CSS token sisteminden
 * (globals.css) gelir — Gece Modu zaten "koyu gece mavisi + turkuaz"
 * marka kimliğidir, buraya özel yeni bir renk EKLENMEDİ.
 */
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Sayfa içi bölümler">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-text-secondary hover:text-text-primary">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary">
              Giriş yap
            </Link>
            <Link href="/sign-up" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text-on-accent">
              Ücretsiz başla
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-14 sm:pt-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-24 lg:pt-28">
          <div className="flex flex-col items-start gap-5 text-left">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
              Ev ve İşletme finansı, tek yerde
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
              Paran kontrolünde.
            </h1>
            <p className="max-w-lg text-lg text-text-secondary">
              Parakip; kişisel bütçeni ve işletmeni birbirine karıştırmadan, gelir-gider, borç-alacak, bütçe ve
              yatırım takibini tek bir güvenli hesaptan yönetmeni sağlar.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className="rounded-2xl bg-accent px-6 py-3.5 text-center text-base font-bold text-text-on-accent">
                Ücretsiz başla
              </Link>
              <a href="#ozellikler" className="rounded-2xl border border-border px-6 py-3.5 text-center text-base font-semibold text-text-primary">
                Nasıl çalışır?
              </a>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
              <li className="flex items-center gap-1.5"><CheckIcon size={15} className="text-accent" /> Kredi kartı gerekmez</li>
              <li className="flex items-center gap-1.5"><CheckIcon size={15} className="text-accent" /> Satır düzeyinde veri izolasyonu</li>
              <li className="flex items-center gap-1.5"><CheckIcon size={15} className="text-accent" /> Türkçe arayüz</li>
            </ul>
          </div>

          {/* Gerçek uygulamanın görsel diliyle (aynı token/bileşen tarzı) hazırlanmış
              ÖRNEK/İLLÜSTRATİF bir dashboard temsili — gerçek kullanıcı verisi
              içermez, ürünün ekran DÜZENİNİ dürüstçe göstermek içindir. */}
          <div aria-hidden="true" className="hidden lg:block">
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="h-2.5 w-16 rounded-full bg-surface-muted" />
                <span className="h-7 w-7 rounded-full bg-accent-soft" />
              </div>
              <div
                className="rounded-2xl border border-border p-5"
                style={{ backgroundImage: "var(--gradient-hero)", boxShadow: "var(--shadow-hero)" }}
              >
                <p className="text-xs text-text-secondary">Toplam bakiye</p>
                <p className="mt-1 text-3xl font-extrabold text-text-primary">₺48.320,00</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-[10px] text-text-muted">Gelir</p>
                  <p className="text-sm font-bold text-success">+₺12.400</p>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-[10px] text-text-muted">Gider</p>
                  <p className="text-sm font-bold text-danger">-₺6.150</p>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-[10px] text-text-muted">Net</p>
                  <p className="text-sm font-bold text-text-primary">+₺6.250</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-surface-muted" />
                      <span className="h-2 w-20 rounded-full bg-surface-muted" />
                    </div>
                    <span className="h-2 w-10 rounded-full bg-surface-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* EV VS İŞLETME */}
        <section className="border-y border-border bg-surface/40 px-6 py-16" id="ev-icin">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-text-primary sm:text-3xl">
              İster evin için, ister işletmen için
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div id="ev-icin" className="rounded-2xl border border-border bg-surface p-7">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <WalletIcon size={20} />
                </span>
                <h3 className="mb-2 text-lg font-bold text-text-primary">Ev için</h3>
                <p className="text-sm text-text-secondary">
                  Kişisel ve ailevi bütçeni tek yerden yönet: gelir-gider takibi, borç-alacak, bütçe hedefleri ve
                  birikimlerin.
                </p>
              </div>
              <div id="isletmeler-icin" className="rounded-2xl border border-border bg-surface p-7">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <BuildingIcon size={20} />
                </span>
                <h3 className="mb-2 text-lg font-bold text-text-primary">İşletmeler için</h3>
                <p className="text-sm text-text-secondary">
                  Kişisel finansından tamamen ayrı bir işletme alanı oluştur; ekip üyelerini rolleriyle (sahip,
                  yönetici, editör) davet et, birlikte yönetin.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ÖZELLİKLER */}
        <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="ozellikler-baslik" id="ozellikler">
          <h2 id="ozellikler-baslik" className="mb-3 text-center text-2xl font-bold text-text-primary sm:text-3xl">
            Tek uygulamada her şey
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-text-secondary">
            Farklı hesap tablolarına, uygulamalara dağılmış finansını tek bir yerde topla.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description, comingSoon }) => (
              <div key={title} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon size={20} />
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-primary">{title}</h3>
                  {comingSoon ? (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-text-muted">
                      Yakında
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-text-secondary">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* GÜVENLİK */}
        <section className="border-y border-border bg-surface/40 px-6 py-16">
          <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
            <div>
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <ShieldIcon size={20} />
              </span>
              <h2 className="mb-3 text-2xl font-bold text-text-primary sm:text-3xl">Güvenlik ve veri gizliliği</h2>
              <p className="text-text-secondary">
                Her alanın (Ev veya İşletme) verisi, veritabanı düzeyinde satır bazlı erişim kurallarıyla izole
                edilir. Bir alandaki kullanıcı, yetkili olmadığı hiçbir hesabın, işlemin ya da borcun detayını
                göremez — ekip halinde çalışırken bile.
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-text-secondary">
              <li className="flex items-start gap-2"><CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" /> Satır düzeyinde erişim kontrolü (RLS)</li>
              <li className="flex items-start gap-2"><CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" /> Finansal kayıtlar asla fiziksel olarak silinmez — yalnızca iptal edilir</li>
              <li className="flex items-start gap-2"><CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" /> Rol bazlı yetkilendirme (sahip / yönetici / editör)</li>
              <li className="flex items-start gap-2"><CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" /> Her önemli işlem denetim kaydına yazılır</li>
            </ul>
          </div>
        </section>

        {/* FİYATLANDIRMA */}
        <section className="mx-auto max-w-4xl px-6 py-16 text-center" id="fiyatlandirma">
          <h2 className="mb-3 text-2xl font-bold text-text-primary sm:text-3xl">Fiyatlandırma</h2>
          <p className="mx-auto mb-10 max-w-lg text-text-secondary">
            Temel Ev ve İşletme alanları ücretsizdir. Gelişmiş ekip ve raporlama özellikleri içeren ücretli plan
            üzerinde çalışıyoruz.
          </p>
          <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-accent bg-surface p-7 text-left">
              <p className="text-sm font-bold text-accent">Ücretsiz</p>
              <p className="mt-1 text-3xl font-extrabold text-text-primary">₺0</p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-accent" /> Sınırsız Ev ve İşletme alanı</li>
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-accent" /> Gelir-gider, borç-alacak, bütçe, yatırım takibi</li>
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-accent" /> Raporlar</li>
              </ul>
              <Link href="/sign-up" className="mt-6 block rounded-xl bg-accent py-2.5 text-center text-sm font-bold text-text-on-accent">
                Ücretsiz başla
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-7 text-left opacity-80">
              <p className="text-sm font-bold text-text-muted">Premium — Yakında</p>
              <p className="mt-1 text-3xl font-extrabold text-text-primary">—</p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-text-muted" /> Genişletilmiş ekip yönetimi</li>
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-text-muted" /> Yapay zekâ destekli içgörüler</li>
                <li className="flex items-center gap-2"><CheckIcon size={15} className="text-text-muted" /> CSV/PDF dışa aktarma</li>
              </ul>
              <span className="mt-6 block rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-text-muted">
                Fiyat henüz açıklanmadı
              </span>
            </div>
          </div>
        </section>

        {/* SON CTA */}
        <section className="mx-auto max-w-2xl px-6 pb-20 text-center">
          <h2 className="mb-3 text-2xl font-bold text-text-primary sm:text-3xl">Hemen ücretsiz başla</h2>
          <p className="mb-6 text-text-secondary">
            Birkaç dakikada ilk alanını oluştur, finansını kontrol altına al.
          </p>
          <Link href="/sign-up" className="inline-block rounded-2xl bg-accent px-8 py-3.5 text-base font-bold text-text-on-accent">
            Ücretsiz hesap oluştur
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Parakip
      </footer>
    </div>
  );
}
