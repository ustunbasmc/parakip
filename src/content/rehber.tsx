import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Rehber içerikleri (özgün, Türkçe). Genel bilgilendirme amaçlıdır;
 * yatırım/finansal tavsiye değildir. Değişken oranlar (faiz, vergi vb.)
 * bilinçli olarak yazılmaz; örnek rakamlar yalnızca hesaplamayı göstermek
 * içindir ve öyle belirtilir.
 */

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Paylaşım görseli ve kart için kısa başlık. */
  short: string;
  audience: "home" | "business";
  published: string;
  updated: string;
  readMinutes: number;
  body: ReactNode;
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-[15px] text-text-secondary">{children}</div>;
}

function Example({ rows, caption }: { rows: [string, string, string][]; caption: string }) {
  return (
    <figure className="overflow-x-auto">
      <table className="w-full border-collapse overflow-hidden rounded-2xl border border-border text-sm">
        <thead className="bg-surface-muted text-left text-text-primary">
          <tr>
            <th className="px-4 py-2.5 font-bold">Kalem</th>
            <th className="px-4 py-2.5 font-bold">Oran</th>
            <th className="px-4 py-2.5 text-right font-bold">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-border">
              <td className="px-4 py-2.5">{r[0]}</td>
              <td className="px-4 py-2.5">{r[1]}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-2 text-xs text-text-muted">{caption}</figcaption>
    </figure>
  );
}

export const GUIDES: Guide[] = [
  {
    slug: "aile-butcesi-nasil-yapilir",
    title: "Aile bütçesi nasıl yapılır? 50/30/20 kuralı ve Türkiye'ye uyarlaması",
    short: "Aile bütçesi nasıl yapılır?",
    description:
      "Aile bütçesini 5 adımda kur: net geliri hesapla, bir ay harcamaları kaydet, giderleri ihtiyaç-istek-birikim diye ayır, 50/30/20 kuralını kendi durumuna uyarla ve her ay gözden geçir.",
    audience: "home",
    published: "2026-09-24",
    updated: "2026-09-24",
    readMinutes: 7,
    body: (
      <>
        <p>
          &quot;Maaş yatıyor, ayın 20&apos;sinde bitiyor&quot; cümlesi çoğu evde tanıdık. Bunun nedeni genellikle az kazanmaktan çok,
          paranın nereye gittiğini tam bilmemek. Aile bütçesi, harcamayı kısmak için değil, parayı bilinçli yönetmek için yapılır:
          neye ne kadar harcadığınızı görür, önceliklerinize göre karar verirsiniz.
        </p>
        <p>Aşağıdaki beş adım, hiç bütçe yapmamış bir aile için bile bir ay içinde işler hâle gelir.</p>

        <h2>1. Hanenin net aylık gelirini hesaplayın</h2>
        <p>
          Elinize geçen tutarı (vergiler ve kesintiler düşülmüş hâli) yazın: maaşlar, düzenli ek gelir, kira geliri, emekli maaşı
          gibi. Geliri düzensiz olanlar (serbest çalışan, esnaf, prim alan) için son 3–6 ayın ortalaması yerine{" "}
          <strong>en düşük ayı</strong> esas almak daha güvenlidir; fazlası geldiğinde birikime aktarılır.
        </p>

        <h2>2. Bir ay boyunca her harcamayı kaydedin</h2>
        <p>
          Bütçenin en kritik adımı budur. Tahminle yapılan bütçeler genellikle tutmaz; çünkü küçük harcamalar (kahve, market
          arası alışveriş, uygulama abonelikleri) akılda kalmaz. Bir ay boyunca her harcamayı kategorisiyle not edin:
        </p>
        <ul>
          <li>Kira veya konut kredisi, aidat</li>
          <li>Faturalar (elektrik, su, doğalgaz, internet, telefon)</li>
          <li>Market ve mutfak</li>
          <li>Ulaşım (yakıt, toplu taşıma, araç masrafları)</li>
          <li>Eğitim, çocuk, sağlık</li>
          <li>Kredi kartı ve kredi ödemeleri</li>
          <li>Dışarıda yeme-içme, eğlence, giyim, abonelikler</li>
        </ul>
        <Tip>
          Kredi kartıyla yapılan harcamayı <strong>harcamayı yaptığınız gün</strong> kaydedin, ekstre ödendiği gün değil. Aksi
          hâlde bu ayın harcaması gelecek aya kayar ve bütçe olduğundan iyi görünür.
        </Tip>

        <h2>3. Giderleri üçe ayırın: ihtiyaç, istek, birikim</h2>
        <p>Ay sonunda kayıtlarınızı üç gruba ayırın:</p>
        <ul>
          <li>
            <strong>İhtiyaçlar:</strong> Ertelenemeyen giderler: kira, faturalar, temel market, ulaşım, sağlık, kredi ve kartların
            asgari ödemeleri.
          </li>
          <li>
            <strong>İstekler:</strong> Hayatı keyifli kılan ama ertelenebilen giderler: dışarıda yemek, tatil, yeni kıyafet,
            abonelikler, hobiler.
          </li>
          <li>
            <strong>Birikim ve borç kapatma:</strong> Acil durum fonu, hedefler için ayrılan para ve asgarinin üzerinde yapılan borç
            ödemeleri.
          </li>
        </ul>

        <h2>4. 50/30/20 kuralını kendi durumunuza uyarlayın</h2>
        <p>
          Sık anılan 50/30/20 kuralı, net gelirin %50&apos;sini ihtiyaçlara, %30&apos;unu isteklere, %20&apos;sini birikime ayırmayı
          önerir. Ancak kiranın ve temel giderlerin gelire oranı yüksek olduğunda ihtiyaçlar tek başına %50&apos;yi rahatlıkla aşabilir.
          Bu durumda kuralı bir başlangıç noktası olarak kullanın, katı bir hedef olarak değil.
        </p>
        <p>
          Gerçekçi bir başlangıç çoğu aile için <strong>60/25/15</strong> olabilir: önce birikime her ay düzenli bir pay ayırmayı
          alışkanlık hâline getirin, gelir arttıkça veya borçlar kapandıkça bu payı %20&apos;ye doğru yükseltin.
        </p>
        <Example
          caption="Örnek hesaplama: 60.000 ₺ net gelirli bir hane için 60/25/15 dağılımı. Rakamlar yalnızca yöntemi göstermek içindir."
          rows={[
            ["İhtiyaçlar", "%60", "36.000 ₺"],
            ["İstekler", "%25", "15.000 ₺"],
            ["Birikim ve borç kapatma", "%15", "9.000 ₺"],
          ]}
        />
        <p>
          Fiyatların hızla değiştiği dönemlerde bütçeyi tutar olarak değil <strong>oran</strong> olarak düşünmek işi kolaylaştırır:
          gelir veya giderler değiştikçe tutarları her ay yeniden hesaplarsınız.
        </p>

        <h2>5. Kategori sınırları koyun ve her ay gözden geçirin</h2>
        <p>
          İlk ayın kayıtları size gerçekçi sınırları gösterir. Örneğin market için geçen ay 11.000 ₺ harcadıysanız, bu ay 10.000 ₺
          hedeflemek uygulanabilir; 6.000 ₺ hedeflemek ise genellikle ilk haftada bırakılan bir bütçeye dönüşür. Market gibi sık
          harcanan kategorilerde aylık sınırı <strong>haftalık</strong> tutara bölmek takibi kolaylaştırır.
        </p>
        <p>
          Ay sonunda eşinizle 15 dakika ayırın: hangi kategoride aşım oldu, neden oldu, gelecek ay neyi değiştireceksiniz?
          Suçlama değil, plan konuşması olsun. Bütçe, iki kişinin ortak kararıyla uygulandığında tutar.
        </p>

        <h2>Sık yapılan hatalar</h2>
        <ul>
          <li>
            <strong>Yıllık giderleri unutmak:</strong> Araç sigortası, kasko, okul masrafları, bayram ve yılbaşı alışverişleri gibi
            giderleri 12&apos;ye bölüp her ay kenara ayırın; geldiklerinde bütçeyi bozmazlar.
          </li>
          <li>
            <strong>Çok katı başlamak:</strong> İsteklere hiç yer bırakmayan bütçe birkaç haftada terk edilir. Küçük de olsa keyif
            payı bırakın.
          </li>
          <li>
            <strong>Kaydı bırakmak:</strong> Bütçe bir kez yapılıp bırakılan bir tablo değil, her ay güncellenen bir alışkanlıktır.
          </li>
        </ul>

        <h2>Parakip ile aile bütçesi</h2>
        <p>
          Parakip&apos;te Ev alanını eşinizle birlikte kullanabilir, harcamaları kategoriye göre kaydedebilir, market veya eğlence gibi
          kategorilere aylık bütçe koyup %80&apos;e gelince bildirim alabilirsiniz. Kira, aidat ve abonelikler bir kez tanımlanınca her
          ay kendiliğinden kaydedilir; ay başında &quot;geçen aya göre ne değişti&quot; özetini görürsünüz. Elle başlamak isterseniz{" "}
          <Link href="/butce-sablonu">ücretsiz aylık bütçe şablonumuzu</Link> kullanabilirsiniz.
        </p>
      </>
    ),
  },
  {
    slug: "esnaf-gelir-gider-defteri",
    title: "Esnaf için gelir-gider defteri nasıl tutulur? Kasa, veresiye ve tedarikçi takibi",
    short: "Esnaf için gelir-gider defteri",
    description:
      "Küçük işletmeler için pratik ön muhasebe: kişisel ve işletme parasını ayırma, kasa-banka-POS düzeni, günlük kayıt, veresiye ve tedarikçi takibi, ay sonu kâr-zarar kontrolü.",
    audience: "business",
    published: "2026-09-24",
    updated: "2026-09-24",
    readMinutes: 7,
    body: (
      <>
        <p>
          Gün sonunda kasanın tutmaması, veresiye defterinde kimin ne kadar borçlu olduğunun karışması, ay sonunda &quot;kazandık mı
          kaybettik mi&quot; sorusuna net cevap verememek küçük işletmelerde çok yaygındır. Bunların çoğu, basit ve düzenli bir
          gelir-gider takibiyle çözülür. Bu rehber, muhasebecinizin tuttuğu resmi defterlerin yerine geçmez; günlük para akışınızı
          sizin görmeniz içindir.
        </p>

        <h2>1. Kişisel paranızı işletmenin parasından ayırın</h2>
        <p>
          En sık yapılan hata, dükkânın kasasından ev alışverişi yapmak veya işletme giderini kişisel karttan ödemektir. Bu
          karışıklık, işletmenin gerçekte ne kazandığını görmeyi imkânsız kılar. Mümkünse işletme için ayrı bir banka hesabı
          kullanın ve kendinize düzenli bir tutar (örneğin aylık bir &quot;maaş&quot;) çekin; bu çekişi de kayda geçirin.
        </p>

        <h2>2. Paranın durduğu yerleri hesap olarak tanımlayın</h2>
        <p>Her para kaynağını ayrı bir hesap olarak takip edin:</p>
        <ul>
          <li><strong>Kasa:</strong> Dükkândaki nakit.</li>
          <li><strong>Banka:</strong> İşletme hesabı veya hesapları.</li>
          <li><strong>POS:</strong> Kartlı satışların henüz bankaya geçmemiş tutarı.</li>
          <li><strong>Kredi kartı:</strong> İşletme harcamalarında kullanılan kart.</li>
        </ul>
        <p>
          Nakitten bankaya para yatırdığınızda bu bir gelir değil, iki hesap arasında <strong>transfer</strong>dir. Transferi gelir
          gibi kaydetmek, kazancınızı olduğundan yüksek gösterir.
        </p>

        <h2>3. Günlük kayıt alışkanlığı edinin</h2>
        <p>
          Kaydı hafta sonuna bırakmak, fişlerin kaybolmasına ve rakamların tahminle girilmesine yol açar. Gün sonunda 5 dakika
          ayırın: günün satışlarını (nakit, kart), yaptığınız giderleri ve varsa tahsilatları girin, ardından kasadaki nakdi sayıp
          kayıtla karşılaştırın. Fark çıkarsa aynı gün aramak, bir ay sonra aramaktan çok daha kolaydır.
        </p>
        <p>Giderleri tutarlı kategorilerle kaydedin; ay sonunda paranın nereye gittiğini ancak böyle görebilirsiniz:</p>
        <ul>
          <li>Kira ve aidat</li>
          <li>Personel ve SGK</li>
          <li>Malzeme / hammadde / ürün alımı</li>
          <li>Elektrik, su, doğalgaz, internet</li>
          <li>Vergi ve harçlar</li>
          <li>Ulaşım, kargo, bakım-onarım</li>
        </ul>

        <h2>4. Veresiye ve alacakları müşteri bazında tutun</h2>
        <p>
          Her veresiye satış, o müşteriden bir alacaktır. Alacağı müşteri adıyla, tutarıyla ve söz verilen ödeme tarihiyle kaydedin.
          Müşteri kısmen ödediğinde kalan tutarı güncelleyin. Vadesi geçen alacakları haftada bir gözden geçirmek, tahsilatı
          geciktiren müşterileri erken fark etmenizi sağlar.
        </p>
        <Tip>
          Alacak tahsil edildiğinde bu, satışın ikinci kez gelir yazılması değildir: satış günü gelir olarak kaydedilir, tahsilat
          günü ise alacak kapanır ve para kasaya/bankaya girer.
        </Tip>

        <h2>5. Tedarikçi borçlarını vade takvimiyle izleyin</h2>
        <p>
          Vadeli mal alımlarını tedarikçi adı, tutar ve vade tarihiyle kaydedin. Böylece hangi hafta ne kadar ödeme çıkacağını
          önceden bilir, kasayı buna göre planlarsınız. Düzenli giderleri (kira, maaş, abonelikler) bir kez tanımlayıp her ay
          otomatik kaydetmek, unutmayı ve gecikme bedellerini önler.
        </p>

        <h2>6. Ay sonunda üç soruyu cevaplayın</h2>
        <ul>
          <li><strong>Bu ay gelir ve gider ne kadar?</strong> Aradaki fark, dönemin kabaca kâr veya zararıdır.</li>
          <li><strong>Kasada ve bankada ne kadar para var?</strong> Kâr ile kasadaki para aynı şey değildir; alacaklar ve borçlar farkı yaratır.</li>
          <li><strong>Ne kadar alacak ve borç açıkta?</strong> Önümüzdeki ayın nakit durumunu bunlar belirler.</li>
        </ul>
        <p>Geçen ayla karşılaştırmak, mevsimsel dalgalanmaları ve artan gider kalemlerini erken görmenizi sağlar.</p>

        <h2>Muhasebecinizle birlikte çalışmak</h2>
        <p>
          Günlük takip, muhasebecinizin işini kolaylaştırır ama resmi defterlerin, beyannamelerin ve e-Fatura gibi yasal
          yükümlülüklerin yerine geçmez. Fatura ve fişleri saklamaya devam edin; hangi belgeleri nasıl tutmanız gerektiği
          konusunda muhasebecinize danışın.
        </p>

        <h2>Parakip ile esnaf gelir-gider takibi</h2>
        <p>
          Parakip&apos;te işletmeniz için ayrı bir alan açar; kasa, banka, POS ve kredi kartını hesap olarak eklersiniz. Müşteri ve
          tedarikçi kartlarıyla alacak-borç takibi yapar, vadesi yaklaşınca telefonunuza bildirim alırsınız. Muhasebecinizi yalnızca
          görme yetkisiyle ekleyebilir veya kayıtları CSV olarak indirip gönderebilirsiniz. Daha fazla bilgi için{" "}
          <Link href="/esnaf-gelir-gider">esnaf gelir-gider sayfamıza</Link> bakın.
        </p>
      </>
    ),
  },
  {
    slug: "kredi-karti-borcu-ve-taksit-yonetimi",
    title: "Kredi kartı borcu ve taksitler nasıl yönetilir?",
    short: "Kredi kartı borcu nasıl yönetilir?",
    description:
      "Hesap kesim ve son ödeme tarihi farkı, asgari ödeme tuzağı, taksitlerin gelecek aylara yükü, borç kapatmada çığ ve kartopu yöntemleri ve kart borcunu kontrol altına almanın pratik yolları.",
    audience: "home",
    published: "2026-09-24",
    updated: "2026-09-24",
    readMinutes: 6,
    body: (
      <>
        <p>
          Kredi kartı doğru kullanıldığında nakit akışını kolaylaştıran bir araçtır; kontrolden çıktığında ise bütçenin en büyük
          gideri hâline gelebilir. Bu rehber genel bilgilendirme amaçlıdır. Faiz, ücret ve asgari ödeme kuralları bankaya ve döneme
          göre değişir; güncel koşulları her zaman ekstrenizden ve bankanızdan kontrol edin.
        </p>

        <h2>Hesap kesim tarihi ve son ödeme tarihi</h2>
        <p>
          <strong>Hesap kesim tarihi</strong>, o dönemin harcamalarının toplandığı ve ekstrenin oluştuğu gündür.{" "}
          <strong>Son ödeme tarihi</strong> ise ekstre borcunu ödemeniz gereken son gündür ve genellikle hesap kesiminden birkaç gün
          sonradır. Hesap kesiminden hemen sonra yapılan bir harcama bir sonraki ekstreye girer; bu yüzden aynı ürünün ödemesi
          hangi gün aldığınıza göre farklı aya düşebilir.
        </p>

        <h2>Asgari ödeme bir çözüm değil, bir erteleme</h2>
        <p>
          Asgari tutarı ödemek kartın gecikmeye düşmesini önler, ancak kalan borç bir sonraki döneme faiziyle devreder. Her ay
          yalnızca asgariyi ödemek, borcun çok daha uzun sürede ve çok daha yüksek toplam maliyetle kapanmasına yol açabilir.
          Mümkünse ekstrenin tamamını, olmuyorsa asgarinin <strong>üzerinde</strong> bir tutarı ödemeyi hedefleyin.
        </p>

        <h2>Taksitler geleceğe borç yazar</h2>
        <p>
          Taksitli alışveriş bugünkü ödemeyi küçültür ama önümüzdeki ayların gelirinden pay alır. Birkaç küçük taksit üst üste
          bindiğinde, her ay kartınıza gelirinizin önemli bir kısmı daha harcamadan önce yansır. Yeni bir taksit eklemeden önce şunu
          sorun: &quot;Önümüzdeki aylarda toplam ne kadar taksit ödeyeceğim?&quot; Bu toplamı görmek, taksidi cazip gösteren
          &quot;ayda sadece şu kadar&quot; algısını dengeler.
        </p>
        <Tip>
          Kartla yaptığınız harcamayı ve taksitleri harcadığınız gün kaydedin. Kart harcaması &quot;henüz ödenmemiş&quot; gibi
          hissettirir; kayıt, bu hissi gerçek rakamla düzeltir.
        </Tip>

        <h2>Borcu kapatmak için iki yöntem</h2>
        <p>Birden fazla kart veya borcunuz varsa, asgari ödemelerin hepsini yaptıktan sonra artan parayı tek bir borca yönlendirin:</p>
        <ul>
          <li>
            <strong>Çığ (avalanche) yöntemi:</strong> Artan parayı önce <strong>en yüksek maliyetli</strong> borca yatırırsınız. Toplamda
            ödenen faiz genellikle daha düşük olur.
          </li>
          <li>
            <strong>Kartopu (snowball) yöntemi:</strong> Artan parayı önce <strong>en küçük</strong> borca yatırırsınız. Borçlar tek tek
            hızla kapandığı için motivasyonu korumak kolaylaşır.
          </li>
        </ul>
        <p>Hangisini seçerseniz seçin, önemli olan her ay düzenli uygulamak ve kapanan borcun ödemesini sıradakine eklemektir.</p>

        <h2>Kart borcunu kontrol altında tutmanın pratik yolları</h2>
        <ul>
          <li><strong>Kart sayısını azaltın:</strong> Takip edilen kart sayısı azaldıkça son ödeme tarihlerini kaçırma riski düşer.</li>
          <li><strong>Otomatik ödeme talimatı verin:</strong> En azından asgari tutar için; unutulan ödemenin gecikme maliyetinden korur.</li>
          <li><strong>Nakit avanstan kaçının:</strong> Nakit çekim genellikle alışverişe göre daha maliyetlidir; ücret ve faizleri ekstrenizde kontrol edin.</li>
          <li><strong>Limit artışını ihtiyaç değil sınır olarak görün:</strong> Kullanılabilir limit, harcanabilir gelir değildir.</li>
          <li><strong>Zorlanıyorsanız erken konuşun:</strong> Ödemelerde zorlanmaya başladığınızda bankanızla yapılandırma seçeneklerini gecikmeye düşmeden görüşün.</li>
        </ul>

        <h2>Parakip ile kart ve taksit takibi</h2>
        <p>
          Parakip&apos;te her kredi kartını ayrı bir hesap olarak ekleyip harcamaları o karttan girebilir, kartın bakiyesini anlık
          görebilirsiniz. Taksitleri ve düzenli ödemeleri tekrarlayan kayıt veya borç olarak tanımlayarak vadesi yaklaşınca
          telefonunuza hatırlatma alabilirsiniz. Genel bütçe düzeni için{" "}
          <Link href="/rehber/aile-butcesi-nasil-yapilir">aile bütçesi rehberimize</Link> göz atın.
        </p>
      </>
    ),
  },
  {
    slug: "acil-durum-fonu",
    title: "Acil durum fonu ne kadar olmalı, nasıl biriktirilir?",
    short: "Acil durum fonu ne kadar olmalı?",
    description:
      "Acil durum fonu nedir, kaç aylık gider kadar olmalı, düzensiz gelirliler için ne değişir, nasıl adım adım biriktirilir ve ne zaman kullanılmalıdır?",
    audience: "home",
    published: "2026-09-24",
    updated: "2026-09-24",
    readMinutes: 5,
    body: (
      <>
        <p>
          Acil durum fonu; iş kaybı, sağlık sorunu, beklenmedik araç veya ev tamiri gibi planlanmamış giderler için ayrılan paradır.
          Amacı getiri sağlamak değil, zor bir anda borca girmeden ayakta kalmanızı sağlamaktır. Bu fon olmadığında küçük bir
          sürpriz bile kredi kartı borcuna ve yüksek maliyetli kredilere dönüşebilir.
        </p>

        <h2>Ne kadar olmalı?</h2>
        <p>
          Sık kullanılan ölçü, <strong>3 ila 6 aylık zorunlu gider</strong> kadar bir birikimdir. Burada toplam harcamanız değil,
          yalnızca zorunlu giderleriniz esas alınır: kira, faturalar, temel market, ulaşım, sigorta ve borçların asgari ödemeleri.
        </p>
        <ul>
          <li>Düzenli maaşlı ve tek gelirli hane: 3–6 ay</li>
          <li>Geliri düzensiz olanlar (serbest çalışan, esnaf, prim ağırlıklı çalışanlar): 6–12 ay</li>
          <li>Bakmakla yükümlü olunan kişi sayısı fazlaysa: aralığın üst tarafı</li>
        </ul>
        <Example
          caption="Örnek hesaplama: aylık zorunlu gideri 30.000 ₺ olan bir hane için hedef aralığı. Rakamlar yalnızca yöntemi göstermek içindir."
          rows={[
            ["İlk hedef", "1 aylık", "30.000 ₺"],
            ["Temel hedef", "3 aylık", "90.000 ₺"],
            ["Güçlü hedef", "6 aylık", "180.000 ₺"],
          ]}
        />

        <h2>Küçük bir ilk hedefle başlayın</h2>
        <p>
          Altı aylık gider ilk bakışta ulaşılmaz görünebilir. Bu yüzden önce <strong>bir aylık zorunlu gider</strong> kadar bir ilk
          hedef belirleyin. İlk hedefe ulaşmak hem ciddi bir güvence sağlar hem de alışkanlığı oturtur; sonra 3 ve 6 aya doğru
          ilerlersiniz.
        </p>

        <h2>Nasıl biriktirilir?</h2>
        <ul>
          <li>
            <strong>Önce kendinize ödeyin:</strong> Maaş yattığı gün, belirlediğiniz tutarı ayrı bir hesaba ayırın. Ay sonunda
            &quot;artarsa biriktiririm&quot; yaklaşımı genellikle işe yaramaz.
          </li>
          <li>
            <strong>Otomatikleştirin:</strong> Bankanızda maaş gününe düzenli transfer talimatı vermek, karar yorgunluğunu ortadan
            kaldırır.
          </li>
          <li>
            <strong>Beklenmedik gelirleri yönlendirin:</strong> İkramiye, prim, vergi iadesi gibi düzensiz gelirlerin bir kısmını
            doğrudan fona ekleyin.
          </li>
          <li>
            <strong>Aboneliklerinizi gözden geçirin:</strong> Kullanmadığınız aboneliklerin toplamı çoğu zaman fona düzenli katkı için
            yeterli bir başlangıçtır.
          </li>
        </ul>

        <h2>Nerede tutulmalı?</h2>
        <p>
          Acil durum fonunun iki temel özelliği olmalı: <strong>hızla erişilebilir</strong> olması ve değer kaybının sınırlı tutulmaya
          çalışılması. Günlük harcama hesabından ayrı tutmak, yanlışlıkla harcanmasını önler. Fiyatların hızlı arttığı dönemlerde
          vadesiz hesapta bekleyen paranın alım gücü azalabilir; erişilebilirlik ile risk arasındaki dengeyi kendi durumunuza göre
          değerlendirin. Bu rehber yatırım tavsiyesi değildir.
        </p>

        <h2>Ne zaman kullanılır, ne zaman kullanılmaz?</h2>
        <p>
          Fon; gerçekten beklenmedik ve zorunlu giderler içindir: iş kaybı, sağlık gideri, acil tamir. Tatil, indirim veya yeni
          telefon gibi planlanabilir harcamalar için ayrı birikim hedefleri koymak daha doğrudur. Fonu kullandıysanız, ilk iş olarak
          yeniden doldurmayı bütçenize ekleyin.
        </p>

        <h2>Parakip ile acil durum fonu</h2>
        <p>
          Parakip&apos;te &quot;Acil durum fonu&quot; adında bir birikim hedefi oluşturup hedef tutarı girebilir, her ay eklediğiniz
          tutarları kaydedebilirsiniz. Uygulama hedefe ne kadar kaldığını ve belirlediğiniz tarihe yetişmek için ayda ne kadar
          ayırmanız gerektiğini gösterir. Zorunlu giderlerinizi hesaplamak için{" "}
          <Link href="/butce-sablonu">ücretsiz bütçe şablonumuzu</Link> kullanabilirsiniz.
        </p>
      </>
    ),
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
