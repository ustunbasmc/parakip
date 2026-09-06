-- 0027_enforce_entry_category_book_match.sql
-- Amaç: transaction_entries.category_id için VERİTABANI SEVİYESİNDE
-- güvenlik ağı. Yalnızca create_simple_transaction() fonksiyonundaki
-- kontrole güvenmek yeterli değildir çünkü transaction_entries'e DOĞRUDAN
-- insert yapma yolu da vardır (transaction_entries_insert_editor_plus RLS
-- politikası bunu editor+ rolündeki kullanıcılar için zaten açık bırakıyor,
-- ör. gelecekte yazılacak farklı bir fonksiyon veya doğrudan API çağrısı
-- için). Bu trigger, HANGİ YOLDAN gelirse gelsin, kategori-defter uyuşmazlığını
-- reddeder — budgets tablosundaki enforce_budget_category_book_match ile
-- birebir aynı desen.

create or replace function public.enforce_entry_category_book_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_book_id uuid;
begin
  if new.category_id is not null then
    select book_id into v_category_book_id
    from public.categories
    where id = new.category_id;

    if not found then
      raise exception 'Kategori bulunamadi (id=%)', new.category_id;
    end if;

    if v_category_book_id is not null and v_category_book_id <> new.book_id then
      raise exception 'Bu kategori baska bir deftere ait, bu islemde kullanilamaz (category_id=%, entry book_id=%)',
        new.category_id, new.book_id;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_entry_category_book_match is
  'transaction_entries.category_id icin veritabani seviyesinde guvenlik agi: '
  'kategori ya global (book_id NULL) ya da entry ile AYNI book_id''ye ait olmali. '
  'create_simple_transaction() fonksiyonundaki kontrolun yaninda, dogrudan '
  'insert/update yollarini da kapsayacak sekilde trigger olarak uygulanir.';

create trigger transaction_entries_enforce_category_book_match
  before insert or update on public.transaction_entries
  for each row execute function public.enforce_entry_category_book_match();
