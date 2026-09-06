-- 0029_extend_audit_log_for_investments.sql
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment', 'budget', 'holding_transaction'));
