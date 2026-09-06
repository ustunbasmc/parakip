-- 0001_init_extensions.sql
-- Amaç: gen_random_uuid() için gerekli uzantıyı etkinleştirmek.
-- Not: Supabase projelerinde pgcrypto genellikle zaten kurulu gelir;
-- IF NOT EXISTS ile idempotent hale getiriliyor.

create extension if not exists "pgcrypto";
