-- 0013_extend_audit_log.sql
-- Amaç: audit_log'u yalnızca transaction_entry ile sınırlı olmaktan
-- çıkarıp debt/debt_payment olaylarını da kapsayacak şekilde genişletmek.
-- Bu, geriye dönük UYUMLUDUR: mevcut transfer/gelir-gider audit satırları
-- etkilenmez, yalnızca kısıtlar gevşetilir/genişletilir.

-- transaction_id artık NOT NULL değil: debt/debt_payment olaylarının
-- karşılık geldiği bir transactions satırı yoktur.
alter table public.audit_log alter column transaction_id drop not null;

-- entity_type: debt ve debt_payment eklendi.
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment'));

-- action: 'updated' eklendi (borç güncelleme olayı için gerekli).
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('created', 'updated', 'cancelled'));

comment on table public.audit_log is
  'Defter bazlı denetim izi. transaction_entry (D8), debt ve debt_payment '
  'olaylarını kapsar. transaction_id yalnızca transaction_entry olaylarında '
  'doludur. Cross-book işlemlerde her defter için ayrı satır yazılır; '
  'before/after yalnızca o deftere ait veriyi içerir.';
