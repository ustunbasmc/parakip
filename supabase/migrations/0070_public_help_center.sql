-- 0070_public_help_center.sql
-- Yardım merkezi herkese açık: oturumsuz ziyaretçiler (ve arama motorları)
-- YALNIZCA yayında olan makaleleri ve aktif kategorileri okuyabilir.
-- Taslak/arşiv makaleler, geri bildirimler ve destek talepleri kapalı kalır
-- (bu tablolarda anon için politika yoktur).

drop policy if exists help_categories_select_active_anon on public.help_categories;
create policy help_categories_select_active_anon
  on public.help_categories for select
  to anon
  using (is_active);
grant select on public.help_categories to anon;

drop policy if exists help_articles_select_published_anon on public.help_articles;
create policy help_articles_select_published_anon
  on public.help_articles for select
  to anon
  using (
    status = 'published'
    and exists (
      select 1 from public.help_categories c
      where c.id = help_articles.category_id and c.is_active
    )
  );
grant select on public.help_articles to anon;

-- Arama SECURITY INVOKER'dır; yukarıdaki anon politikası aynen geçerlidir.
grant execute on function public.help_normalize(text) to anon;
grant execute on function public.search_help_articles(text, integer) to anon;
