-- 0019_update_debt_jsonb_and_verify.sql
-- Amaç: update_debt'teki boolean-bayrak tasarımını (p_clear_due_date,
-- p_clear_note) TAMAMEN KALDIRIP tek bir JSONB parametresine geçirmek.
--
-- GEREKÇE (E10 bulgusu): 6 parametreli önceki imzada, pozisyonel bir
-- çağrıda rastgele bir metin literal'i ('Y' gibi), PostgreSQL'in metin->
-- boolean örtük dönüşüm kuralı yüzünden SESSİZCE p_clear_due_date=true'ya
-- dönüşebiliyordu. Bu, hata vermeden yanlış alanı boşaltan tehlikeli bir
-- davranıştı. JSONB tasarımı bu riski YAPISAL olarak ortadan kaldırır:
--   - Yalnızca 2 parametre kaldığı için pozisyonel karışıklık alanı çok daralır.
--   - Her alan için jsonb_typeof() ile AÇIK tip kontrolü yapılır; beklenmeyen
--     bir tip veya bilinmeyen bir anahtar gelirse SESSİZCE YOK SAYILMAZ,
--     anlamlı bir hata ile REDDEDİLİR.
--   - "Alan sağlanmadı" (anahtar yok -> değiştirme) ile "alan bilerek null
--     yapıldı" (anahtar var, değeri JSON null -> temizle) ayrımı, JSONB'nin
--     doğal `?` (key exists) operatörüyle KESİN olarak ayrılır.
--
-- NOT (madde 1 doğrulaması): Bu migration'dan önce yapılan sorgu,
-- update_debt'in ORİJİNAL 4 parametreli imzasının (uuid,text,date,text)
-- veritabanında ARTIK MEVCUT OLMADIĞINI doğrulamıştır (0018'deki
-- "drop function if exists" başarıyla çalışmış). Bu migration, 0018'de
-- oluşturulan 6 parametreli (boolean bayraklı) imzayı YENİ tasarım
-- lehine DROP eder.

drop function if exists public.update_debt(uuid, text, date, boolean, text, boolean);

create or replace function public.update_debt(
  p_debt_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
  v_before jsonb;
  v_new_counterparty text;
  v_new_due_date date;
  v_new_note text;
  v_allowed_keys text[] := array['counterparty_name', 'due_date', 'note'];
  v_key text;
begin
  -- Tip kontrolü: p_updates gerçekten bir JSON NESNESİ olmalı.
  -- (ör. bir dizi, sayı veya string gönderilirse SESSİZCE yok saymak yerine
  -- açıkça reddedilir.)
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception
      'p_updates bir JSON nesnesi olmalidir, ornek: {"counterparty_name": "Yeni Ad"}. Alinan tip: %',
      coalesce(jsonb_typeof(p_updates), 'null');
  end if;

  -- Bilinmeyen alan adlarını erken ve açıkça reddet — sessizce yok
  -- saymak, çağıranın yazım hatasını (ör. "counterpartyName") fark
  -- etmeden hiçbir şey güncellenmemesine yol açabilirdi.
  for v_key in select jsonb_object_keys(p_updates)
  loop
    if not (v_key = any (v_allowed_keys)) then
      raise exception
        'update_debt: bilinmeyen alan "%": yalnizca su alanlar guncellenebilir: %',
        v_key, array_to_string(v_allowed_keys, ', ');
    end if;
  end loop;

  select book_id, status, counterparty_name, due_date, note
    into v_book_id, v_status, v_new_counterparty, v_new_due_date, v_new_note
  from public.debts
  where id = p_debt_id;

  if v_book_id is null then
    raise exception 'Borc bulunamadi (id=%)', p_debt_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Iptal edilmis bir borc guncellenemez';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  v_before := jsonb_build_object(
    'counterparty_name', v_new_counterparty, 'due_date', v_new_due_date, 'note', v_new_note
  );

  -- counterparty_name: anahtar YOKSA değişmez. Anahtar VARSA, NOT NULL
  -- bir alan olduğu için değeri null OLAMAZ (açıkça reddedilir) ve tipi
  -- string olmalıdır (aksi halde açık hata).
  if p_updates ? 'counterparty_name' then
    if jsonb_typeof(p_updates -> 'counterparty_name') = 'null' then
      raise exception 'counterparty_name null yapilamaz (bu alan zorunludur)';
    end if;
    if jsonb_typeof(p_updates -> 'counterparty_name') <> 'string' then
      raise exception
        'counterparty_name bir metin (string) olmalidir, alinan tip: %',
        jsonb_typeof(p_updates -> 'counterparty_name');
    end if;
    v_new_counterparty := p_updates ->> 'counterparty_name';
    if length(trim(v_new_counterparty)) = 0 then
      raise exception 'counterparty_name bos olamaz';
    end if;
  end if;

  -- due_date: anahtar YOKSA değişmez. Anahtar VARSA ve değeri JSON null
  -- ise BİLEREK temizlenir. Aksi halde geçerli bir tarih string''i
  -- (YYYY-MM-DD) olmalıdır; ayrıştırılamazsa açık hata verilir.
  if p_updates ? 'due_date' then
    if jsonb_typeof(p_updates -> 'due_date') = 'null' then
      v_new_due_date := null;
    else
      if jsonb_typeof(p_updates -> 'due_date') <> 'string' then
        raise exception
          'due_date bir tarih metni ("YYYY-MM-DD") veya null olmalidir, alinan tip: %',
          jsonb_typeof(p_updates -> 'due_date');
      end if;
      begin
        v_new_due_date := (p_updates ->> 'due_date')::date;
      exception when others then
        raise exception 'due_date gecerli bir tarih degil: %', p_updates ->> 'due_date';
      end;
    end if;
  end if;

  -- note: aynı mantık (yok=değişmez, null=temizle, string=güncelle).
  if p_updates ? 'note' then
    if jsonb_typeof(p_updates -> 'note') = 'null' then
      v_new_note := null;
    else
      if jsonb_typeof(p_updates -> 'note') <> 'string' then
        raise exception
          'note bir metin (string) veya null olmalidir, alinan tip: %',
          jsonb_typeof(p_updates -> 'note');
      end if;
      v_new_note := p_updates ->> 'note';
    end if;
  end if;

  update public.debts
  set counterparty_name = v_new_counterparty,
      due_date = v_new_due_date,
      note = v_new_note
  where id = p_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'debt', p_debt_id, v_before,
    jsonb_build_object('counterparty_name', v_new_counterparty, 'due_date', v_new_due_date, 'note', v_new_note)
  );
end;
$$;

comment on function public.update_debt is
  'GÜVENLİ, TİP KONTROLLÜ PARTIAL UPDATE. p_updates bir JSON nesnesidir; '
  'yalnizca icinde ANAHTARI BULUNAN alanlar guncellenir (ör. {"note": "X"} '
  'yalnizca note''u degistirir). Bir alani BILEREK temizlemek icin degerini '
  'JSON null yapin (ör. {"due_date": null}). Bilinmeyen anahtar, yanlis tip '
  've gecersiz tarih formati SESSIZCE YOK SAYILMAZ — hepsi acik bir hata '
  'olarak reddedilir. Cagirici mutlaka isimli parametre (p_debt_id, '
  'p_updates) kullanmalidir.';

revoke all on function public.update_debt(uuid, jsonb) from public;
grant execute on function public.update_debt(uuid, jsonb) to authenticated;
