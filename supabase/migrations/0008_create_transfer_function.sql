-- 0008_create_transfer_function.sql
-- Amaç: Transfer'in iki entry'sini TEK fonksiyon çağrısında, TEK
-- veritabanı işleminde, atomik olarak yazmak. Bu, "app kodunun iki
-- entry'yi aynı DB işleminde eklemeyi unutmama disiplinine güvenmek"
-- yerine, atomikliği DOĞRUDAN VERİTABANI SEVİYESİNDE garanti eder.
--
-- Aynı defter içi transfer, Ev-İşletme (cross-book) transfer ve kredi
-- kartı ödemesi (banka->kredi kartı) — hepsi bu TEK fonksiyonla
-- modellenir; aralarındaki tek fark hangi book_id/account_id çiftlerinin
-- geçildiğidir, fonksiyonun kendisi hiçbirini özel durum olarak görmez.

create or replace function public.create_transfer(
  p_from_book_id uuid,
  p_from_account_id uuid,
  p_to_book_id uuid,
  p_to_account_id uuid,
  p_amount_cents bigint,
  p_currency text default 'TRY',
  p_occurred_at timestamptz default now(),
  p_from_note text default null,
  p_to_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer -- Header ve entries'i, çağıranın kendi RLS görünürlüğünden
                  -- bağımsız olarak atomik yazabilmek için gerekli. Bu yüzden
                  -- yetki kontrolü burada MANUEL yapılır (aşağıda) — SEC
                  -- DEFINER kullanmak asla "yetki kontrolünü atla" anlamına
                  -- gelmez, tam tersi: kontrolü RLS'e değil, buraya taşır.
set search_path = public
as $$
declare
  v_transaction_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'p_amount_cents pozitif bir tutar olmalidir (kuruş, integer)';
  end if;

  if p_from_book_id = p_to_book_id and p_from_account_id = p_to_account_id then
    raise exception 'Kaynak ve hedef hesap ayni olamaz';
  end if;

  -- Manuel yetki kontrolü: auth.uid(), SECURITY DEFINER içinde de
  -- gerçek çağıran kullanıcıyı doğru döner (oturum GUC'undan okunur,
  -- fonksiyon sahibinden değil) — bu yüzden bu kontrol güvenilirdir.
  if not public.has_book_role(p_from_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Kaynak defter icin yetkiniz yok (book_id=%)', p_from_book_id;
  end if;

  if not public.has_book_role(p_to_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Hedef defter icin yetkiniz yok (book_id=%)', p_to_book_id;
  end if;

  insert into public.transactions (type, occurred_at, metadata)
  values ('transfer', p_occurred_at, p_metadata)
  returning id into v_transaction_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, currency, note)
  values
    (v_transaction_id, p_from_book_id, p_from_account_id, -p_amount_cents, p_currency, p_from_note);

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, currency, note)
  values
    (v_transaction_id, p_to_book_id, p_to_account_id, p_amount_cents, p_currency, p_to_note);

  -- Not: check_transfer_balance deferred trigger'ı, bu fonksiyonu çağıran
  -- üst düzey veritabanı işlemi COMMIT edildiğinde otomatik çalışır ve
  -- toplamın sıfır olduğunu doğrular (burada -p_amount_cents + p_amount_cents = 0,
  -- her zaman sağlanır — ama trigger yine de gerçek bir güvenlik ağı olarak kalır:
  -- ör. ileride bu fonksiyon dışında bir yol açılırsa da kural bozulmaz).

  return v_transaction_id;
end;
$$;

comment on function public.create_transfer is
  'Aynı defter içi, Ev-İşletme (cross-book) veya kredi kartı ödemesi '
  'transferini tek çağrıda, tek veritabanı işleminde, iki entry ile atomik '
  'olarak oluşturur. Yetki kontrolü fonksiyon içinde manuel yapılır (SECURITY '
  'DEFINER RLS''i bypass ettiği için).';

revoke all on function public.create_transfer(
  uuid, uuid, uuid, uuid, bigint, text, timestamptz, text, text, jsonb
) from public;

grant execute on function public.create_transfer(
  uuid, uuid, uuid, uuid, bigint, text, timestamptz, text, text, jsonb
) to authenticated;
