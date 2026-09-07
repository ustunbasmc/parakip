# Admin Paneli — Kurulum ve Kullanım

## ⚠️ Önemli Güvenlik Notu

Bu panel (`/admin`), **sizin açık talebiniz üzerine**, RLS'i (Row Level
Security) tamamen **bypass eden** `service_role` client'ı ile çalışır.
Bu, panele erişimi olan HERKESİN tüm kullanıcıların tüm finansal
verisine (bakiye, işlem, borç vb.) eriştiği ve düzenleyebildiği anlamına
gelir.

- **"Silme" gerçek DELETE değildir** — mevcut "finansal kayıtlar
  fiziksel olarak silinmez" ilkesiyle tutarlı kalması için, admin
  panelindeki "İptal et" işlemi de yalnızca `status='cancelled'` olarak
  işaretler, kayıt geçmişte görünmeye devam eder.
- **Kullanıcı profili bilgileri** (ad, soyad, telefon) admin panelinden
  **gerçekten** düzenlenebilir/değiştirilebilir (bunlar finansal kayıt
  değildir).
- Her admin işlemi `platform_admin_audit_log` tablosuna kaydedilir —
  bu, erişiminizi **hiç kısıtlamaz**, yalnızca ne yapıldığını kaydeder.

## İlk Admin Kullanıcısını Ekleme

Kimse kendini admin yapamaz (veritabanı seviyesinde engellidir) — ilk
admin kullanıcısını **Supabase Dashboard → SQL Editor**'den elle
eklemeniz gerekir:

```sql
insert into public.platform_admins (user_id, granted_by)
values ('BURAYA_KENDI_USER_ID_NIZI_YAZIN', 'İlk kurulum');
```

Kendi `user_id`'nizi bulmak için:
```sql
select id, email from auth.users where email = 'sizin@eposta.com';
```

## Yeni Admin Ekleme/Çıkarma

Aynı şekilde SQL Editor'den:
```sql
-- Ekleme
insert into public.platform_admins (user_id, granted_by) values ('...', 'Admin adı');
-- Çıkarma
delete from public.platform_admins where user_id = '...';
```

## Panel Sayfaları

- `/admin` — genel istatistikler (toplam kullanıcı/alan/işlem sayısı)
- `/admin/users` — tüm kullanıcılar listesi (son 200 kayıt)
- `/admin/users/[id]` — kullanıcı detayı, profil düzenleme, sahip
  olduğu/üye olduğu tüm alanlar
- `/admin/spaces/[id]` — alan detayı: hesaplar, son 50 işlem (iptal
  edilebilir), borç/alacaklar

## Bu Turda Yapılmayanlar (Dürüst Liste)

- **Hesap/kategori/bütçe/yatırım düzenleme formları** — yalnızca
  görüntüleme var, gerçek düzenleme (isim değiştirme, tutar düzeltme)
  bu turda eklenmedi.
- **Arama/filtreleme** — kullanıcı listesi yalnızca son 200 kayıt,
  arama kutusu yok.
- **Sayfalama** — 200'den fazla kullanıcı olduğunda eski kayıtlar
  görünmez.
- **Raporlar** (istenen "raporlara erişim") — genel istatistik dışında
  detaylı rapor ekranı eklenmedi.
- **Admin girişi için 2FA/ayrı kimlik doğrulama** — admin, normal
  Parakip hesabıyla giriş yapıp `/admin`'e gider; ayrı bir admin login
  ekranı yok.
