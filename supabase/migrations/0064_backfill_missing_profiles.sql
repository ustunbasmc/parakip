-- 0064_backfill_missing_profiles.sql
-- Amaç: auth.users'ta olup profiles satırı OLMAYAN hesaplar için eksik
-- profil satırını oluşturmak. Kayıt tetikleyicisi (handle_new_user, bkz.
-- 0002) ile AYNI değerler kullanılır (display_name = e-posta). Yeniden
-- çalıştırılması güvenlidir: yalnızca eksik satırları ekler, var olan
-- hiçbir profile dokunmaz. Finansal tablolar etkilenmez.

insert into public.profiles (user_id, display_name)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;
