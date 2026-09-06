import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PARAKİP RPC ÇAĞRI KURALI (zorunlu):
 *
 * Veritabanındaki finansal SECURITY DEFINER fonksiyonlarına (create_transfer,
 * create_simple_transaction, create_debt, update_debt, cancel_debt,
 * create_debt_payment, cancel_debt_payment) uygulama kodundan ASLA doğrudan
 * `supabase.rpc(...)` ile çağrı yapılmaz. Bunun yerine bu dosyadaki tipli
 * sarmalayıcı (wrapper) fonksiyonlar kullanılır.
 *
 * Neden: `supabase.rpc()`'nin ikinci argümanı zaten bir JS nesnesidir (isimli
 * parametre), bu yüzden JS/TS tarafında "pozisyonel çağrı" diye bir şey
 * teknik olarak mümkün değildir. Ancak asıl risk şudur: nesnenin ALAN
 * ADLARINI yanlış yazmak (ör. "p_amountCents" yerine "p_amount_cents") veya
 * yanlış TİPTE bir değer göndermek (ör. sayı yerine string) fark edilmeden
 * PostgREST/PostgreSQL'in örtük tip dönüşümüne takılabilir. Bu dosyadaki her
 * sarmalayıcı, parametre adlarını ve tiplerini TypeScript seviyesinde sabitler
 * — derleme zamanında yakalanır, çalışma zamanına kadar beklenmez.
 *
 * update_debt İSTİSNAİ TASARIMI: veritabanı fonksiyonu artık tek bir `jsonb`
 * parametresi (`p_updates`) alıyor (bkz. migration 0019). `UpdateDebtFields`
 * arayüzündeki alanlar OPTIONAL (?) olarak tanımlıdır; bir alanı hiç
 * göndermemek (undefined) "değiştirme" anlamına gelir, `null` göndermek ise
 * "bilerek temizle" anlamına gelir. Bu ayrım, JSON.stringify'ın `undefined`
 * değerli anahtarları JSON çıktısından OTOMATİK OLARAK ATMASI sayesinde
 * çalışır — supabase-js bu nesneyi JSON'a çevirip gönderdiğinde, gönderilmeyen
 * alanlar veritabanı tarafında hiç "anahtar" olarak görünmez.
 */

type Uuid = string;

// ─────────────────────────────────────────────
// create_transfer
// ─────────────────────────────────────────────

export interface CreateTransferParams {
  p_from_book_id: Uuid;
  p_from_account_id: Uuid;
  p_to_book_id: Uuid;
  p_to_account_id: Uuid;
  /** Kuruş cinsinden, pozitif tam sayı. */
  p_amount_cents: number;
  p_currency?: string;
  /** ISO 8601 zaman damgası. Belirtilmezse veritabanı now() kullanır. */
  p_occurred_at?: string;
  p_from_note?: string | null;
  p_to_note?: string | null;
  p_metadata?: Record<string, unknown>;
}

export async function createTransfer(client: SupabaseClient, params: CreateTransferParams) {
  return client.rpc("create_transfer", params);
}

// ─────────────────────────────────────────────
// create_simple_transaction
// ─────────────────────────────────────────────

export interface CreateSimpleTransactionParams {
  p_book_id: Uuid;
  p_account_id: Uuid;
  p_type: "income" | "expense";
  /** İşaret kuralı zorunludur: income>0, expense<0 (kuruş). */
  p_amount_cents: number;
  p_category_id?: Uuid | null;
  p_note?: string | null;
  p_occurred_at?: string;
  p_metadata?: Record<string, unknown>;
}

export async function createSimpleTransaction(
  client: SupabaseClient,
  params: CreateSimpleTransactionParams
) {
  return client.rpc("create_simple_transaction", params);
}

// ─────────────────────────────────────────────
// create_debt
// ─────────────────────────────────────────────

export interface CreateDebtParams {
  p_book_id: Uuid;
  p_counterparty_name: string;
  p_direction: "payable" | "receivable";
  /** Kuruş cinsinden, pozitif tam sayı. */
  p_principal_cents: number;
  /** ISO 'YYYY-MM-DD' tarih string'i. */
  p_due_date?: string | null;
  p_note?: string | null;
}

export async function createDebt(client: SupabaseClient, params: CreateDebtParams) {
  return client.rpc("create_debt", params);
}

/**
 * create_debt() ile AYNI davranış + isteğe bağlı metadata/customer_id/
 * supplier_id (bkz. migration 0051). İşletme Satış/Alış akışları BUNU
 * kullanır — mevcut createDebt() diğer tüm yerlerde DEĞİŞMEDEN kalır.
 */
export interface CreateDebtV2Params extends CreateDebtParams {
  /** Güvenilir sistem sınıflandırması, ör. {"business_kind":"sale"}. Kullanıcı notuyla KARIŞTIRILMAZ. */
  p_metadata?: Record<string, string>;
  p_customer_id?: Uuid | null;
  p_supplier_id?: Uuid | null;
}

export async function createDebtV2(client: SupabaseClient, params: CreateDebtV2Params) {
  return client.rpc("create_debt_v2", params);
}

// ─────────────────────────────────────────────
// update_debt — jsonb tabanlı, güvenli partial update (bkz. 0019)
// ─────────────────────────────────────────────

export interface UpdateDebtFields {
  /** Boş bırakılamaz; gönderilirse dolu bir metin olmalıdır. */
  counterparty_name?: string;
  /** undefined = değiştirme; null = bilerek temizle; string = yeni değer. */
  due_date?: string | null;
  /** undefined = değiştirme; null = bilerek temizle; string = yeni değer. */
  note?: string | null;
}

export interface UpdateDebtParams {
  p_debt_id: Uuid;
  p_updates: UpdateDebtFields;
}

export async function updateDebt(client: SupabaseClient, params: UpdateDebtParams) {
  return client.rpc("update_debt", params);
}

// ─────────────────────────────────────────────
// cancel_debt
// ─────────────────────────────────────────────

export interface CancelDebtParams {
  p_debt_id: Uuid;
}

export async function cancelDebt(client: SupabaseClient, params: CancelDebtParams) {
  return client.rpc("cancel_debt", params);
}

// ─────────────────────────────────────────────
// create_debt_payment
// ─────────────────────────────────────────────

export interface CreateDebtPaymentParams {
  p_debt_id: Uuid;
  /** Kuruş cinsinden, pozitif tam sayı. */
  p_amount_cents: number;
  p_paid_at?: string;
  /**
   * transaction_entries.id — VERİLİRSE tutar/yön borç ile TAM eşleşmelidir
   * (payable->negatif, receivable->pozitif). Verilmezse ödeme is_external=true
   * (harici/manüel) olarak kaydedilir.
   */
  p_transaction_entry_id?: Uuid | null;
}

export async function createDebtPayment(client: SupabaseClient, params: CreateDebtPaymentParams) {
  return client.rpc("create_debt_payment", params);
}

// ─────────────────────────────────────────────
// cancel_debt_payment
// ─────────────────────────────────────────────

export interface CancelDebtPaymentParams {
  p_payment_id: Uuid;
}

export async function cancelDebtPayment(client: SupabaseClient, params: CancelDebtPaymentParams) {
  return client.rpc("cancel_debt_payment", params);
}

// ─────────────────────────────────────────────
// create_budget
// ─────────────────────────────────────────────

export interface CreateBudgetParams {
  p_book_id: Uuid;
  /** Kuruş cinsinden, pozitif tam sayı. */
  p_amount_cents: number;
  /** Herhangi bir gün verilebilir; veritabanı ayın 1'ine normalize eder. */
  p_period_month: string;
  /** null/undefined = toplam (genel) bütçe; doluysa kategori bazlı bütçe. */
  p_category_id?: Uuid | null;
}

export async function createBudget(client: SupabaseClient, params: CreateBudgetParams) {
  return client.rpc("create_budget", params);
}

// ─────────────────────────────────────────────
// update_budget — jsonb tabanlı, güvenli partial update (bkz. 0024)
// ─────────────────────────────────────────────

export interface UpdateBudgetFields {
  /** Yalnızca bu alan güncellenebilir; pozitif olmalıdır. */
  amount_cents?: number;
}

export interface UpdateBudgetParams {
  p_budget_id: Uuid;
  p_updates: UpdateBudgetFields;
}

export async function updateBudget(client: SupabaseClient, params: UpdateBudgetParams) {
  return client.rpc("update_budget", params);
}

// ─────────────────────────────────────────────
// cancel_budget
// ─────────────────────────────────────────────

export interface CancelBudgetParams {
  p_budget_id: Uuid;
}

export async function cancelBudget(client: SupabaseClient, params: CancelBudgetParams) {
  return client.rpc("cancel_budget", params);
}

// ─────────────────────────────────────────────
// create_investment_buy
// ─────────────────────────────────────────────

export type AssetType = "bist" | "us_stock" | "gold" | "fx" | "crypto";

export type FxRateSource = "manual" | "provider";

export interface CreateInvestmentBuyParams {
  p_portfolio_id: Uuid;
  p_asset_symbol: string;
  p_asset_type: AssetType;
  /** Kesirli olabilir (kripto, gram altın). */
  p_quantity: number;
  /** Birim başına fiyat, VARLIĞIN KENDİ para biriminde, kuruş, pozitif tam sayı. */
  p_price_cents: number;
  p_cash_account_id: Uuid;
  p_currency?: string;
  p_occurred_at?: string;
  p_note?: string | null;
  /**
   * ÇOKLU PARA BİRİMİ (v1): varlığın para birimi hesabın para biriminden
   * FARKLIYSA bu dört alanın TAMAMI zorunludur; aynıysa TAMAMI atlanmalıdır
   * (gönderilirse veritabanı reddeder).
   */
  p_fx_rate?: number | null;
  p_fx_rate_date?: string | null;
  p_fx_rate_source?: FxRateSource | null;
  /** Hesap para biriminde, gerçekte hareket eden tutar (kuruş). */
  p_converted_amount_cents?: number | null;
}

export async function createInvestmentBuy(client: SupabaseClient, params: CreateInvestmentBuyParams) {
  return client.rpc("create_investment_buy", params);
}

// ─────────────────────────────────────────────
// create_investment_sell
// ─────────────────────────────────────────────

export interface CreateInvestmentSellParams {
  p_portfolio_id: Uuid;
  p_asset_symbol: string;
  p_asset_type: AssetType;
  p_quantity: number;
  p_price_cents: number;
  p_cash_account_id: Uuid;
  p_occurred_at?: string;
  p_note?: string | null;
  /** create_investment_buy ile aynı çoklu para birimi kuralı. */
  p_fx_rate?: number | null;
  p_fx_rate_date?: string | null;
  p_fx_rate_source?: FxRateSource | null;
  p_converted_amount_cents?: number | null;
}

export async function createInvestmentSell(client: SupabaseClient, params: CreateInvestmentSellParams) {
  return client.rpc("create_investment_sell", params);
}

// ─────────────────────────────────────────────
// cancel_holding_transaction
// ─────────────────────────────────────────────

export interface CancelHoldingTransactionParams {
  p_holding_transaction_id: Uuid;
}

/**
 * Yalnızca ilgili varlık (holding) üzerindeki EN SON aktif işlem iptal
 * edilebilir (LIFO) — weighted-average modelde lot-bazlı izleme yoktur.
 * Veritabanı bu kısıtı zaten zorunlu kılar; burada yalnızca dokümante
 * edilmiştir.
 */
export async function cancelHoldingTransaction(
  client: SupabaseClient,
  params: CancelHoldingTransactionParams
) {
  return client.rpc("cancel_holding_transaction", params);
}

// ─────────────────────────────────────────────
// archive_account
// ─────────────────────────────────────────────

export interface ArchiveAccountParams {
  p_account_id: Uuid;
  /** true = arşivle (varsayılan), false = arşivden çıkar. */
  p_archived?: boolean;
}

/**
 * Yalnızca owner/admin çağırabilir (mevcut accounts_update_editor_plus RLS
 * politikası editor'a genel UPDATE izni verir ama bu, ARŞİVLEME için
 * kasıtlı olarak kullanılmaz — uygulama kodu arşivleme için HER ZAMAN bu
 * fonksiyonu çağırır, asla doğrudan .update({is_archived}) yapmaz).
 */
export async function archiveAccount(client: SupabaseClient, params: ArchiveAccountParams) {
  return client.rpc("archive_account", params);
}

/**
 * "Hesabı arşivle ve işlemleri iptal et" — hesaba bağlı TÜM aktif
 * işlemleri iptal eder (fiziksel silme YOK) ve hesabı arşivler, hepsi
 * TEK atomik veritabanı işleminde (bkz. migration 0055). Dönen değer,
 * iptal edilen işlem sayısıdır.
 */
export async function archiveAccountAndCancelTransactions(
  client: SupabaseClient,
  params: { p_account_id: Uuid }
) {
  return client.rpc("archive_account_and_cancel_transactions", params);
}

// ─────────────────────────────────────────────
// create_recurring_payment_rule / set_recurring_payment_rule_active
// ─────────────────────────────────────────────

export interface CreateRecurringPaymentRuleParams {
  p_book_id: Uuid;
  p_counterparty_name: string;
  p_direction: "payable" | "receivable";
  p_amount_cents: number;
  p_frequency: "weekly" | "monthly";
  /** yalnızca frequency="monthly" için, 1-28 arası. */
  p_day_of_month?: number | null;
  /** yalnızca frequency="weekly" için, 0(Pazar)-6(Cumartesi) arası. */
  p_day_of_week?: number | null;
  /** ISO 'YYYY-MM-DD'; verilmezse bugün. */
  p_start_date?: string;
  p_note?: string | null;
}

export async function createRecurringPaymentRule(
  client: SupabaseClient,
  params: CreateRecurringPaymentRuleParams
) {
  return client.rpc("create_recurring_payment_rule", params);
}

export interface SetRecurringPaymentRuleActiveParams {
  p_rule_id: Uuid;
  p_is_active: boolean;
}

/** Yalnızca owner/admin çağırabilir. Kural asla silinmez, yalnızca durdurulur/yeniden başlatılır. */
export async function setRecurringPaymentRuleActive(
  client: SupabaseClient,
  params: SetRecurringPaymentRuleActiveParams
) {
  return client.rpc("set_recurring_payment_rule_active", params);
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// NOT: create_budget/update_budget/cancel_budget ve
// cancel_holding_transaction wrapper'ları bu dosyada ZATEN mevcuttu
// (yukarıda) — burada yineleme YAPILMADI.
// ─────────────────────────────────────────────
// upsert_market_price — YALNIZCA sunucu tarafı (service_role) kullanmalı.
// Bu fonksiyon kasıtlı olarak burada YOK: normal istemci kodu (browser/
// server client, anon veya authenticated anahtarla) bunu çağıramaz —
// veritabanı tarafında yalnızca service_role'e GRANT edilmiştir (bkz.
// 0033). Piyasa veri adaptör katmanı, service-role client'ı ayrı ve dar
// kapsamlı bir dosyada (ör. server-admin.ts, henüz oluşturulmadı)
// tanımlayıp bu fonksiyonu oradan çağırmalıdır.
// ─────────────────────────────────────────────
