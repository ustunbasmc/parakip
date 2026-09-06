-- 0007_rls_transactions_entries.sql
-- Amaç: transactions ve transaction_entries için RLS.
--
-- MİMARİ NOT (D7): transactions'ın kendi book_id'si olmadığı için
-- görünürlüğü entries üzerinden TÜRETİLİR (EXISTS). API katmanı da
-- her zaman "önce entries filtrele, sonra header join et" sırasıyla
-- sorgu yazmalı — tersi sıra, erişimi olmayan header'lar için boş
-- entries dönebilir ve kafa karıştırabilir.
--
-- CROSS-BOOK İPTAL YETKİSİ HAKKINDA AÇIK NOKTA (bilinen risk, aşağıda
-- rapora da yazıldı): can_cancel_transaction, D11'in "her iki defterde
-- de owner/admin" şartını uygular. D11'in ikinci şartı olan "iptal eden
-- kişi transferi BAŞLATAN kişi olmalı" şartı, bu bilgi audit_log
-- tablosunda tutulacağı için (D8) ve audit_log migration'ı henüz
-- yazılmadığı için BU MİGRASYONDA UYGULANMIYOR. audit_log eklenince
-- can_cancel_transaction bu şartı da kontrol edecek şekilde
-- GÜNCELLENECEK (CREATE OR REPLACE FUNCTION ile, yeni migration'da).

-- ─────────────────────────────────────────────
-- Yardımcı fonksiyon: cross-book dahil iptal yetkisi
-- ─────────────────────────────────────────────

create or replace function public.can_cancel_transaction(p_transaction_id uuid)
returns boolean
language sql
security definer -- RLS'i bypass eder: fonksiyonun kendisi, çağıranın
                  -- görebildiği entries ile sınırlı kalmadan TÜM ilgili
                  -- book_id'leri toplayabilmeli (aksi halde cross-book
                  -- transferde kullanıcı yalnızca kendi tarafını görüp
                  -- karşı tarafın rolünü hiç kontrol edemez).
stable
set search_path = public
as $$
  select coalesce(
    bool_and(public.has_book_role(book_id, array['owner', 'admin'])),
    false
  )
  from (
    select distinct book_id
    from public.transaction_entries
    where transaction_id = p_transaction_id
  ) as distinct_books;
$$;

comment on function public.can_cancel_transaction is
  'auth.uid(), verilen transaction''a bağlı TÜM defterlerde owner/admin ise true döner. '
  'Aynı defter transferinde tek defter kontrol edilir; cross-book transferde her iki defter '
  'de kontrol edilir (D11). "Başlatan kişi" şartı audit_log eklenince buraya eklenecek.';

-- Yardımcı fonksiyon: bir transaction'ın aktif olup olmadığını kontrol eder.
-- SECURITY DEFINER OLMASI ZORUNLU: transactions üzerindeki SELECT RLS
-- politikası (transactions_select_via_entries), bir transaction'ı yalnızca
-- ona bağlı EN AZ BİR entry varsa görünür kılıyor. Ancak entries INSERT
-- politikası tam da "bu transaction'a ait İLK entry'yi eklerken" bu
-- kontrolü yapmak zorunda — o anda henüz hiçbir entry yok, dolayısıyla
-- normal (invoker haklarıyla) bir SELECT, transactions satırını RLS
-- yüzünden hiç göremez ve kontrol yanlışlıkla "yok" sonucu döner
-- (tavuk-yumurta problemi). SECURITY DEFINER bu döngüyü kırar.
create or replace function public.is_transaction_active(p_transaction_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id
      and t.status = 'active'
  );
$$;

comment on function public.is_transaction_active is
  'RLS yardımcı fonksiyonu: transactions üzerindeki SELECT RLS''i bypass ederek '
  'bir transaction''ın aktif olup olmadığını kontrol eder. transaction_entries '
  'INSERT politikasında, ilk entry eklenirken oluşan tavuk-yumurta RLS döngüsünü '
  'kırmak için SECURITY DEFINER olarak tanımlanmıştır.';

-- ─────────────────────────────────────────────
-- transactions
-- ─────────────────────────────────────────────

alter table public.transactions enable row level security;

create policy transactions_select_via_entries
  on public.transactions for select
  using (
    exists (
      select 1
      from public.transaction_entries te
      where te.transaction_id = transactions.id
        and public.is_book_member(te.book_id)
    )
  );

-- Header, book'a özgü hassas veri taşımadığı için (D7) herhangi bir
-- kimliği doğrulanmış kullanıcı oluşturabilir; gerçek yetki kontrolü
-- entries INSERT politikasında yapılır. Uygulamada header+entries her
-- zaman create_transfer() gibi tek bir fonksiyon/işlem içinde birlikte
-- yazılacağı için "yetkisiz kullanıcı yalnızca header oluşturur" riski
-- pratikte oluşmaz.
create policy transactions_insert_authenticated
  on public.transactions for insert
  with check (auth.uid() is not null);

create policy transactions_update_cancel_only
  on public.transactions for update
  using (public.can_cancel_transaction(id))
  with check (public.can_cancel_transaction(id));

-- Bilinçli olarak: DELETE politikası YOK. RLS etkinken politika
-- tanımlanmayan komut kimse tarafından çalıştırılamaz (superuser hariç)
-- — bu, "finansal kayıtlar silinmez" ilkesinin veritabanı seviyesinde
-- garantisidir.

grant select, insert, update on public.transactions to authenticated;

-- ─────────────────────────────────────────────
-- transaction_entries
-- ─────────────────────────────────────────────

alter table public.transaction_entries enable row level security;

create policy transaction_entries_select_member
  on public.transaction_entries for select
  using (public.is_book_member(book_id));

create policy transaction_entries_insert_editor_plus
  on public.transaction_entries for insert
  with check (
    public.has_book_role(book_id, array['owner', 'admin', 'editor'])
    and public.is_transaction_active(transaction_id)
  );

-- Bilinçli olarak: UPDATE ve DELETE politikası YOK. Entries, oluşturulduktan
-- sonra hiçbir zaman değiştirilemez veya silinemez — bir transaction'ın
-- iptali yalnızca transactions.status üzerinden yapılır (bkz. 0006), bu
-- sayede "bir entry iptal edilip diğeri aktif kalsın" durumu yapısal
-- olarak zaten imkânsızdır (entries'in kendi status'u hiç yok).

grant select, insert on public.transaction_entries to authenticated;
