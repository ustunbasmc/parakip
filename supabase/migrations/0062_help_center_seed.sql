-- 0062_help_center_seed.sql
-- Amaç: Yardım Merkezi için başlangıç kategorileri ve makaleleri.
-- İDEMPOTENT: slug çakışmasında hiçbir şey yapılmaz (`on conflict do
-- nothing`) — admin panelinden sonradan düzenlenen içerik bu dosya tekrar
-- çalıştırılsa bile EZİLMEZ.

insert into public.help_categories (slug, title, description, sort_order) values
  ('baslarken',           'Parakip''e Başlarken',        'Temel kavramlar ve ilk adımlar',                    10),
  ('hesap-ve-profil',     'Hesap ve Profil',             'Profil bilgileri, e-posta ve giriş',                20),
  ('ev-alani',            'Ev Alanı',                    'Aile ve kişisel bütçe takibi',                      30),
  ('isletme-alani',       'İşletme Alanı',               'Satış, alış, müşteri ve tedarikçi takibi',          40),
  ('gelir-gider',         'Gelir ve Gider İşlemleri',    'İşlem ekleme, düzenleme ve iptal',                  50),
  ('hesaplar-bakiyeler',  'Hesaplar ve Bakiyeler',       'Banka, nakit ve kart hesapları',                    60),
  ('butceler',            'Bütçeler',                    'Aylık ve kategori bazlı bütçeler',                  70),
  ('borc-alacak',         'Borç ve Alacak',              'Borçlar, alacaklar, ödeme ve tahsilat',             80),
  ('yatirimlar',          'Yatırımlar',                  'Hisse, altın, döviz ve kripto takibi',              90),
  ('raporlar',            'Raporlar',                    'Gelir-gider ve kategori analizleri',               100),
  ('kategoriler',         'Kategoriler',                 'Gelir ve gider kategorilerini yönetme',            110),
  ('abonelik-odeme',      'Abonelik ve Ödeme',           'Premium planlar, ödeme ve yenileme',               120),
  ('guvenlik-gizlilik',   'Güvenlik ve Gizlilik',        'Verilerinin nasıl korunduğu',                      130),
  ('hesap-silme-veri',    'Hesap Silme ve Veri İşlemleri','Hesap silme ve veri dışa aktarma',                140)
on conflict (slug) do nothing;

with seed (slug, category_slug, title, summary, body, steps, tags, related_path, related_label, context_keys, is_faq, sort_order) as (
  values
  -- 1
  ('parakip-nedir', 'baslarken',
   'Parakip nedir?',
   'Parakip; evinin ve işletmenin gelir, gider, hesap, borç ve yatırımlarını tek yerden takip etmeni sağlayan bir uygulamadır.',
   $b$Parakip'te verilerin "alan" denilen ayrı bölümlerde tutulur. Bir Ev alanın ve istersen bir veya daha fazla İşletme alanın olabilir.

Her alanın kayıtları birbirinden tamamen ayrıdır. Ev alanındaki bir harcama İşletme alanında görünmez; bu sayede kişisel ve ticari paran karışmaz.

Sağ üstteki alan seçiciden hangi alanda çalıştığını her zaman değiştirebilirsin.$b$,
   jsonb_build_array(
     'İlk olarak bir hesap ekle (ör. banka hesabın veya nakit).',
     'Ana sayfadaki + butonuyla ilk gelir veya giderini kaydet.',
     'Hareketler ekranından tüm işlemlerini takip et.'),
   array['başlangıç', 'nedir', 'alan', 'tanıtım'], '/home', 'Ana sayfaya git', array['home'], true, 10),

  -- 2
  ('ev-alani-nasil-kullanilir', 'ev-alani',
   'Ev alanı nasıl kullanılır?',
   'Ev alanı; maaş, fatura, market gibi günlük ve aile harcamalarını takip etmek içindir.',
   $b$Ev alanında hesaplarını, gelir ve giderlerini, bütçelerini, borçlarını ve yatırımlarını takip edebilirsin.

Ücretsiz Ev planında 5 hesaba kadar ekleyebilirsin. Daha fazla hesap için Ev Premium'a geçebilirsin.$b$,
   jsonb_build_array(
     'Sağ üstteki alan seçiciden Ev alanını seç.',
     'Hesaplar ekranından banka, nakit veya kart hesaplarını ekle.',
     'Ana sayfadaki + butonuyla gelir ve giderlerini kaydet.',
     'İstersen Bütçeler ekranından aylık harcama sınırı belirle.'),
   array['ev', 'aile', 'kişisel', 'alan'], '/home', 'Ana sayfaya git', array['home'], false, 10),

  -- 3
  ('isletme-alani-nasil-kullanilir', 'isletme-alani',
   'İşletme alanı nasıl kullanılır?',
   'İşletme alanı; satış, alış, masraf, müşteri ve tedarikçilerini ev bütçenden ayrı takip etmek içindir.',
   $b$İşletme alanı, Ev alanından tamamen ayrıdır. İşletmene ait hesaplar ve işlemler yalnızca bu alanda görünür.

İşletme alanında Müşteriler ve Tedarikçiler ekranları da açılır. Böylece kime ne sattığını, kimden ne aldığını ve kimden ne kadar alacağın olduğunu görebilirsin.

Birden fazla işletmen varsa her biri için ayrı bir İşletme alanı oluşturabilirsin.$b$,
   jsonb_build_array(
     'Profil menüsünden "Alanlarım"a gir ve yeni bir İşletme alanı oluştur.',
     'Sağ üstteki alan seçiciden işletmeni seç.',
     'İşletmenin banka ve kasa hesaplarını ekle.',
     'Ana sayfadaki + butonundan Satış ekle, Alış ekle veya Masraf ekle seçeneklerini kullan.'),
   array['işletme', 'şirket', 'esnaf', 'ticari', 'alan'], '/settings/spaces', 'Alanlarıma git', array['business'], false, 10),

  -- 4
  ('gelir-nasil-eklenir', 'gelir-gider',
   'Gelir nasıl eklenir?',
   'Maaş, kira geliri gibi gelirlerini ana sayfadaki + butonundan birkaç adımda kaydedebilirsin.',
   $b$Eklediğin gelir, seçtiğin hesabın bakiyesini artırır ve Hareketler ekranında görünür.

Gelirin doğru alanda kaydedildiğinden emin olmak için önce sağ üstten doğru alanı (Ev veya İşletme) seç.$b$,
   jsonb_build_array(
     'Ana sayfada sağ alttaki + butonuna dokun.',
     '"Gelir ekle"yi seç.',
     'Tutarı yaz, parayı aldığın hesabı ve kategoriyi seç.',
     'İstersen tarih ve açıklama ekle.',
     '"Kaydet"e dokun.'),
   array['gelir', 'maaş', 'ekle', 'işlem', 'para girişi'], '/home', 'Ana sayfaya git', array['transaction-form'], true, 10),

  -- 5
  ('gider-nasil-eklenir', 'gelir-gider',
   'Gider nasıl eklenir?',
   'Market, fatura, kira gibi harcamalarını ana sayfadaki + butonundan kaydedebilirsin.',
   $b$Eklediğin gider, seçtiğin hesabın bakiyesinden düşer. Doğru kategori seçersen raporlar ve bütçeler çok daha anlamlı olur.

İşletme alanında bu seçenek "Masraf ekle" olarak görünür.$b$,
   jsonb_build_array(
     'Ana sayfada sağ alttaki + butonuna dokun.',
     '"Gider ekle"yi (İşletme alanında "Masraf ekle") seç.',
     'Tutarı yaz, ödemeyi yaptığın hesabı ve kategoriyi seç.',
     'İstersen tarih ve açıklama ekle.',
     '"Kaydet"e dokun.'),
   array['gider', 'harcama', 'masraf', 'fatura', 'ekle', 'işlem'], '/home', 'Ana sayfaya git', array['transaction-form'], true, 20),

  -- 6
  ('islem-nasil-duzenlenir', 'gelir-gider',
   'İşlem nasıl düzenlenir?',
   'Yanlış girdiğin bir gelir veya gideri Hareketler ekranından düzenleyebilirsin.',
   $b$Düzenleme yalnızca gelir ve gider işlemlerinde yapılabilir. Transferleri düzenlemek yerine iptal edip yeniden oluşturman gerekir.$b$,
   jsonb_build_array(
     'Hareketler ekranını aç.',
     'Düzenlemek istediğin işlemi sağa kaydır.',
     '"Düzenle"ye dokun.',
     'Tutar, kategori, hesap, tarih veya açıklamayı değiştir ve kaydet.'),
   array['düzenle', 'değiştir', 'yanlış', 'hata', 'işlem'], '/transactions', 'Hareketlere git', array['transactions'], false, 30),

  -- 7
  ('islem-nasil-iptal-edilir', 'gelir-gider',
   'İşlem nasıl iptal veya arşivlenir?',
   'Hatalı bir işlemi iptal edebilirsin; kayıt silinmez, "İptal edildi" olarak kalır ve bakiyeye etki etmez.',
   $b$Parakip'te işlemler kalıcı olarak silinmez. İptal edilen işlem geçmişte "İptal" etiketiyle görünmeye devam eder, ama bakiyelerini ve raporlarını etkilemez. Bu sayede geçmişin her zaman izlenebilir kalır.

Artık kullanmadığın bir hesabı da arşivleyebilirsin. Arşivlenen hesaba yeni işlem eklenemez ama geçmiş hareketleri korunur.$b$,
   jsonb_build_array(
     'Hareketler ekranını aç.',
     'İptal etmek istediğin işlemi sola kaydır.',
     '"İptal et"e dokun ve onayla.',
     'Bir hesabı arşivlemek için Hesaplar ekranında hesabı sola kaydırıp "Arşivle"yi seç.'),
   array['iptal', 'sil', 'arşiv', 'geri al', 'işlem', 'hesap'], '/transactions', 'Hareketlere git', array['transactions', 'accounts'], false, 40),

  -- 8
  ('kategori-nasil-eklenir', 'kategoriler',
   'Kategori nasıl eklenir?',
   'Kendi gelir ve gider kategorilerini oluşturarak harcamalarını istediğin gibi gruplayabilirsin.',
   $b$Kategoriler her alan için ayrıdır. Ev alanında eklediğin kategori İşletme alanında görünmez.

Yeni eklediğin kategori, işlem eklerken kategori listesinde hemen görünür.$b$,
   jsonb_build_array(
     'Sağ üstteki profil menüsünü aç.',
     '"Kategoriler"e gir.',
     '"Yeni kategori"ye dokun.',
     'Kategori adını yaz, gelir mi gider mi olduğunu seç ve kaydet.'),
   array['kategori', 'ekle', 'yeni', 'grup'], '/settings/categories', 'Kategorilere git', array['categories'], false, 10),

  -- 9
  ('kategori-nasil-degistirilir', 'kategoriler',
   'Kategori nasıl değiştirilir?',
   'Bir kategorinin adını değiştirebilir ya da bir işlemin kategorisini sonradan düzeltebilirsin.',
   $b$Kategori adını değiştirdiğinde, o kategoriye ait eski işlemler de yeni adla görünür.

Kullanmadığın bir kategoriyi kaldırabilirsin; geçmiş işlemlerin bundan etkilenmez.$b$,
   jsonb_build_array(
     'Kategori adını değiştirmek için: Profil menüsü → Kategoriler → kategoriye dokun → "Kategoriyi düzenle".',
     'Bir işlemin kategorisini değiştirmek için: Hareketler → işlemi sağa kaydır → "Düzenle".',
     'Yeni kategoriyi seç ve kaydet.'),
   array['kategori', 'değiştir', 'düzenle', 'ad', 'yeniden adlandır'], '/settings/categories', 'Kategorilere git', array['categories'], false, 20),

  -- 10
  ('butce-nasil-olusturulur', 'butceler',
   'Bütçe nasıl oluşturulur?',
   'Bir ay için toplam veya kategori bazlı harcama sınırı belirleyip ne kadar harcadığını takip edebilirsin.',
   $b$Bütçe, harcamalarını kısıtlamaz; yalnızca belirlediğin sınıra ne kadar yaklaştığını gösterir.

Sınıra yaklaştığında veya aştığında bütçe kartının rengi değişir, böylece harcamalarını zamanında fark edersin.$b$,
   jsonb_build_array(
     'Daha Fazla menüsünden "Bütçeler"e gir.',
     '"Yeni bütçe"ye dokun.',
     'Tutarı yaz; istersen belirli bir kategori seç.',
     'Kaydet. Bütçe durumunu ana sayfada ve Bütçeler ekranında görebilirsin.'),
   array['bütçe', 'limit', 'sınır', 'harcama', 'aylık'], '/budgets', 'Bütçelere git', array['budgets'], false, 10),

  -- 11
  ('borc-nasil-eklenir', 'borc-alacak',
   'Borç nasıl eklenir?',
   'Birine olan borcunu veya birinden alacağını kaydedip kalan tutarı takip edebilirsin.',
   $b$Borç kaydı, hesap bakiyeni hemen değiştirmez. Bakiye yalnızca ödeme veya tahsilat kaydettiğinde değişir.

Düzenli ödemelerin (kira, kredi taksidi gibi) için "Tekrarlayan ödemeler" bölümünü kullanabilirsin.$b$,
   jsonb_build_array(
     'Daha Fazla menüsünden "Borçlar"a gir.',
     '"Yeni borç/alacak"a dokun.',
     'Borç mu alacak mı olduğunu seç.',
     'Kişi veya kurum adını, tutarı ve istersen vade tarihini yaz.',
     'Kaydet.'),
   array['borç', 'alacak', 'kredi', 'vade', 'ekle'], '/debts', 'Borçlara git', array['debts'], false, 10),

  -- 12
  ('odeme-tahsilat-nasil-kaydedilir', 'borc-alacak',
   'Ödeme veya tahsilat nasıl kaydedilir?',
   'Bir borcu ödediğinde veya alacağını tahsil ettiğinde bunu borç kaydının içinden işleyebilirsin.',
   $b$Ödeme kaydettiğinde seçtiğin hesaptan para düşer ve borcun kalan tutarı azalır. Tahsilat kaydettiğinde ise hesabına para girer ve alacağın azalır.

Kısmi ödeme yapabilirsin; kalan tutar otomatik hesaplanır.$b$,
   jsonb_build_array(
     'Borçlar ekranından ilgili borç veya alacağa dokun.',
     '"Ödeme ekle" (alacaklarda "Tahsilat ekle") butonuna dokun.',
     'Tutarı ve paranın çıktığı/girdiği hesabı seç.',
     'Kaydet.'),
   array['ödeme', 'tahsilat', 'borç', 'alacak', 'kısmi'], '/debts', 'Borçlara git', array['debts'], false, 20),

  -- 13
  ('yatirim-islemi-nasil-eklenir', 'yatirimlar',
   'Yatırım işlemi nasıl eklenir?',
   'Hisse, altın, döviz veya kripto alış ve satışlarını kaydedip portföyünü takip edebilirsin.',
   $b$Desteklenen varlık türleri: BIST hisse, ABD hissesi, altın, döviz ve kripto.

Döviz ve kripto için güncel piyasa fiyatı otomatik alınır; diğer varlıklarda portföy değeri girdiğin fiyatlara göre hesaplanır.

Parakip yatırım tavsiyesi vermez; yalnızca yaptığın işlemleri kaydetmene yardımcı olur.$b$,
   jsonb_build_array(
     'Daha Fazla menüsünden "Yatırımlar"a gir.',
     '"Alış yap" veya "Satış yap" butonuna dokun.',
     'Varlık türünü ve adını seç, miktar ve birim fiyatı yaz.',
     'Paranın çıktığı veya girdiği hesabı seç ve kaydet.'),
   array['yatırım', 'hisse', 'altın', 'döviz', 'kripto', 'portföy', 'alış', 'satış'], '/investments', 'Yatırımlara git', array['investments'], false, 10),

  -- 14
  ('hesap-nasil-eklenir', 'hesaplar-bakiyeler',
   'Hesap nasıl eklenir?',
   'Banka hesabı, nakit, kredi kartı gibi hesaplarını ekleyerek bakiyelerini takip edebilirsin.',
   $b$Her işlem bir hesaba bağlıdır. Bu yüzden işlem eklemeden önce en az bir hesap oluşturman gerekir.

Hesabı eklerken mevcut bakiyesini girersen, Parakip'teki bakiye gerçek bakiyenle aynı başlar.

Ücretsiz Ev planında 5 hesaba kadar ekleyebilirsin.$b$,
   jsonb_build_array(
     'Alt menüden "Hesaplar"a gir.',
     '+ butonuna ("Yeni hesap") dokun.',
     'Hesap adını, türünü ve para birimini seç.',
     'Başlangıç bakiyesini yaz ve kaydet.'),
   array['hesap', 'banka', 'nakit', 'kart', 'bakiye', 'ekle'], '/accounts', 'Hesaplara git', array['accounts'], true, 10),

  -- 15
  ('verilerim-guvende-mi', 'guvenlik-gizlilik',
   'Verilerim güvende mi?',
   'Verilerin şifreli bağlantı üzerinden taşınır ve yalnızca senin ve davet ettiğin kişilerin erişebileceği şekilde saklanır.',
   $b$Parakip'te her alanın verisi yalnızca o alanın üyelerine açıktır. Başka bir kullanıcı senin alanına davet edilmeden hiçbir kaydını göremez.

Parakip banka şifreni, kart bilgilerini veya internet bankacılığı girişini asla istemez. Bu bilgileri kimseyle paylaşma; destek talebine de yazma.

Hesabını korumak için güçlü bir şifre kullan ve Güvenlik ayarlarından şifreni düzenli olarak değiştir.$b$,
   jsonb_build_array(
     'Güçlü ve başka yerde kullanmadığın bir şifre seç.',
     'Profil menüsü → Güvenlik bölümünden şifreni güncelleyebilirsin.',
     'Şüpheli bir durum görürsen hemen destek talebi oluştur.'),
   array['güvenlik', 'gizlilik', 'şifre', 'veri', 'kvkk', 'güvende'], '/settings/security', 'Güvenlik ayarlarına git', array['security'], true, 10),

  -- 16
  ('isletme-islemleri-nasil-takip-edilir', 'isletme-alani',
   'İşletme işlemleri nasıl takip edilir?',
   'Satış, alış ve masraflarını kaydederek işletmenin kârını, alacaklarını ve borçlarını takip edebilirsin.',
   $b$Satış ekle: Müşterine yaptığın satışı kaydeder. Veresiye satışta hesabına hemen para girmez; müşteri adına bir alacak oluşur, tahsil ettiğinde bakiye artar.

Alış ekle: Tedarikçiden yaptığın alımı kaydeder. Vadeli alışta tedarikçiye borç oluşur.

Masraf ekle: Kira, elektrik gibi işletme giderlerini kaydeder.

Ana sayfadaki dönem filtresiyle günlük, haftalık, aylık veya yıllık özetini görebilirsin.$b$,
   jsonb_build_array(
     'Sağ üstten İşletme alanını seç.',
     'Ana sayfadaki + butonundan Satış, Alış veya Masraf ekle.',
     'Müşteriler ve Tedarikçiler ekranlarından kişi bazlı bakiyeleri takip et.',
     'Raporlar ekranından dönemsel analizleri incele.'),
   array['işletme', 'satış', 'alış', 'masraf', 'müşteri', 'tedarikçi', 'veresiye'], '/home', 'Ana sayfaya git', array['business'], false, 20),

  -- 17
  ('abonelik-nasil-calisir', 'abonelik-odeme',
   'Abonelik nasıl çalışır?',
   'Ev Premium ve İşletme Premium planları; aylık veya yıllık olarak satın alınır ve süre sonunda elle yenilenir.',
   $b$Ev Premium, Ev alanında sınırsız hesap sağlar. Alanın sahibi Premium ise alandaki tüm üyeler faydalanır.

İşletme Premium, ilgili İşletme alanındaki ücretsiz plan limitlerini (hesap, aylık işlem, borç, müşteri, tedarikçi) kaldırır. Her İşletme alanı için ayrı alınır.

Abonelikler otomatik yenilenmez. Süren dolduğunda plan sayfasından yeniden satın alabilirsin.

Banka havalesiyle ödeme yaptıysan, ödemeyi bildirdikten sonra ekibimiz kontrol edip aboneliğini genellikle 1 iş günü içinde aktif eder.$b$,
   jsonb_build_array(
     'Profil menüsünden "Planım ve limitlerim"e gir.',
     'Aylık veya yıllık dönemi seç.',
     'Ödeme adımlarını tamamla.',
     'Havale ile ödediysen "Ödemeyi yaptım, bildir" butonuna dokunmayı unutma.'),
   array['abonelik', 'premium', 'ödeme', 'plan', 'fiyat', 'havale', 'yenileme'], '/settings/plan', 'Planıma git', array['subscription'], true, 10),

  -- 18
  ('hesabimi-nasil-silebilirim', 'hesap-silme-veri',
   'Hesabımı nasıl silebilirim?',
   'Hesap yönetimi ekranından silme talebi oluşturabilirsin; talebin bir bekleme süresinden sonra işleme alınır.',
   $b$Silme talebi oluşturduğunda verilerin hemen silinmez. Fikrini değiştirirsen bekleme süresi içinde talebi iptal edebilirsin.

Bekleme süresi dolduktan sonra kişisel bilgilerin kalıcı olarak temizlenir ve bu işlem geri alınamaz.

Silmeden önce kayıtlarını saklamak istersen Hareketler veya Raporlar ekranından CSV olarak dışa aktarabilirsin.$b$,
   jsonb_build_array(
     'Profil menüsünden "Hesap yönetimi"ne gir.',
     'Hesap silme talebini başlat.',
     'Güvenlik için şifreni tekrar gir ve onayla.',
     'Vazgeçersen aynı ekrandan "Talebi iptal et"e dokun.'),
   array['hesap silme', 'sil', 'kapat', 'veri', 'kvkk', 'dışa aktar'], '/settings/account', 'Hesap yönetimine git', array['account-deletion'], true, 10),

  -- 19
  ('hata-ile-karsilasirsam', 'baslarken',
   'Bir hata ile karşılaşırsam ne yapmalıyım?',
   'Önce sayfayı yenilemeyi dene; sorun devam ederse "Hata bildir" ile bize ulaş.',
   $b$Hata bildirirken sorunun hangi ekranda olduğunu ve ne yaptığında ortaya çıktığını kısaca yazman, sorunu çok daha hızlı çözmemizi sağlar.

İstersen bir ekran görüntüsü de ekleyebilirsin. Ekran görüntüsü yalnızca sen ve destek ekibi tarafından görülebilir.

Şifreni, kart bilgilerini veya banka giriş bilgilerini asla destek talebine yazma.$b$,
   jsonb_build_array(
     'Sayfayı yenile veya uygulamayı kapatıp yeniden aç.',
     'İnternet bağlantını kontrol et.',
     'Sorun devam ederse Daha Fazla menüsünden "Hata bildir"e dokun.',
     'Ne olduğunu kısaca yaz, istersen ekran görüntüsü ekle ve gönder.'),
   array['hata', 'sorun', 'çalışmıyor', 'bug', 'destek', 'bildir'], '/support/new?type=bug', 'Hata bildir', array['support'], true, 20),

  -- 20
  ('destek-talebimi-nasil-takip-ederim', 'baslarken',
   'Destek talebimi nasıl takip ederim?',
   'Oluşturduğun tüm destek taleplerini ve yanıtları "Destek Taleplerim" ekranından görebilirsin.',
   $b$Talebinin durumu şunlardan biri olur: Açık, İnceleniyor, Yanıtlandı, Yanıtın bekleniyor, Çözüldü veya Kapatıldı.

Ekibimiz yanıt verdiğinde talebin "Yanıtlandı" olur. Talebin içinden yeni mesaj yazarak bize tekrar ulaşabilirsin.

Yeni mesajları görmek için sayfayı yenilemen yeterlidir.$b$,
   jsonb_build_array(
     'Daha Fazla menüsünden "Destek Taleplerim"e gir.',
     'Takip etmek istediğin talebe dokun.',
     'Yanıtları oku; gerekirse alttaki kutuya mesajını yazıp gönder.'),
   array['destek', 'talep', 'takip', 'yanıt', 'mesaj'], '/support/tickets', 'Destek taleplerime git', array['support'], false, 30),

  -- 21
  ('profil-bilgilerimi-nasil-degistiririm', 'hesap-ve-profil',
   'Profil bilgilerimi nasıl değiştiririm?',
   'Adını, telefonunu, e-posta adresini ve profil fotoğrafını Profil bilgilerim ekranından güncelleyebilirsin.',
   $b$E-posta adresini değiştirdiğinde yeni adresine bir onay bağlantısı gönderilir. Bağlantıya tıklayana kadar eski adresin geçerli kalır.$b$,
   jsonb_build_array(
     'Sağ üstteki profil menüsünü aç.',
     '"Profil bilgilerim"e gir.',
     'Değiştirmek istediğin bilgiyi güncelle ve kaydet.'),
   array['profil', 'ad', 'e-posta', 'telefon', 'fotoğraf'], '/settings/profile', 'Profilime git', array['profile'], false, 10),

  -- 22
  ('raporlar-ne-gosterir', 'raporlar',
   'Raporlar ne gösterir?',
   'Raporlar ekranı; gelir-gider dengeni, kategori dağılımını ve aylık eğilimini grafiklerle gösterir.',
   $b$Raporlar yalnızca seçili alanın verilerini gösterir. Ev ve İşletme raporları birbirine karışmaz.

İptal edilen işlemler raporlara dahil edilmez. Raporu CSV olarak dışa aktarıp başka programlarda da kullanabilirsin.$b$,
   jsonb_build_array(
     'Daha Fazla menüsünden "Raporlar"a gir.',
     'İncelemek istediğin dönemi seç.',
     'Kategori ve aylık grafiklere göz at.'),
   array['rapor', 'grafik', 'analiz', 'csv', 'dışa aktar'], '/reports', 'Raporlara git', array['reports'], false, 10)
)
insert into public.help_articles
  (category_id, slug, title, summary, body, steps, tags, related_path, related_label, context_keys, is_faq, sort_order, status)
select c.id, s.slug, s.title, s.summary, s.body, s.steps, s.tags, s.related_path, s.related_label, s.context_keys, s.is_faq, s.sort_order, 'published'
from seed s
join public.help_categories c on c.slug = s.category_slug
on conflict (slug) do nothing;
