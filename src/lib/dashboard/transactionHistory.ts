import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * İşlem Geçmişi ekranının veri katmanı. Tüm sorgular RLS'e tabidir —
 * cross-book bir transferin KARŞI tarafına ait entry, kullanıcı o
 * defterin üyesi değilse RLS tarafından zaten hiç döndürülmez (bkz.
 * transaction_entries_select_member politikası, 0007). Bu dosyada bunun
 * için EKSTRA bir kontrol YOKTUR — çünkü gerekmez, RLS zaten yeterlidir.
 */

export type TransactionKindFilter = "all" | "income" | "expense" | "transfer" | "investment";
export type StatusFilter = "active" | "cancelled" | "all";

export interface TransactionFilters {
  kind?: TransactionKindFilter;
  accountId?: string;
  categoryId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD (dahil)
  search?: string;
  status?: StatusFilter;
  limit?: number;
  offset?: number;
}

export interface TransferInfo {
  /** null = kullanıcı bu tarafa erişemiyor (cross-book, RLS gizliyor). */
  fromAccountName: string | null;
  toAccountName: string | null;
  /** Yalnızca iki taraf FARKLI defterlere aitse dolu (Ev–İşletme gibi). */
  fromSpaceName: string | null;
  toSpaceName: string | null;
  crossBook: boolean;
}

export interface TransactionHistoryRow {
  entryId: string;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  isInvestment: boolean;
  status: "active" | "cancelled";
  amountCents: number;
  currency: string;
  note: string | null;
  occurredAt: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Yalnızca type==='transfer' için dolu. */
  transfer?: TransferInfo;
  /** Güvenilir sistem sınıflandırması (bkz. business.ts) — kullanıcı notuyla KARIŞTIRILMAZ. */
  businessKind?: "sale" | "purchase" | "expense";
  /**
   * Bu satır GERÇEK bir transaction_entries kaydı DEĞİL, henüz tahsil/
   * ödeme edilmemiş bir veresiye satış/vadeli alış TEMSİLİDİR (debts
   * tablosundan türetilir). Hesap bakiyesini HENÜZ ETKİLEMEMİŞTİR —
   * yalnızca kayıt görünürlüğü içindir (bkz. madde 2). Doluysa entryId
   * yerine bu debt.id'ye, /debts/{id} sayfasına yönlendirilmelidir.
   */
  creditDebtId?: string;
  /** Yalnızca creditDebtId dolu satırlar için — müşteri/tedarikçi adı. */
  counterpartyName?: string | null;
  dueDate?: string | null;
}

interface RawEntryRow {
  id: string;
  transaction_id: string;
  amount_cents: number;
  currency: string;
  note: string | null;
  account_id: string;
  category_id: string | null;
  accounts: { name: string } | { name: string }[] | null;
  categories: { name: string } | { name: string }[] | null;
  transactions:
    | { id: string; type: string; status: string; occurred_at: string; metadata: Record<string, unknown> }
    | { id: string; type: string; status: string; occurred_at: string; metadata: Record<string, unknown> }[]
    | null;
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * type='investment' seçiliyse, önce bu deftere ait yatırım işlemlerinin
 * transaction_id'lerini bulur (portfolios -> holdings -> holding_transactions
 * zinciri üzerinden) — çünkü transactions.type düzeyinde ayrı bir
 * 'investment' değeri YOKTUR (alış/satış nakit bacağı income/expense
 * olarak kaydedilir, bkz. create_investment_buy/sell). Diğer türler için
 * bu sorgu yalnızca "hangi işlemler yatırımdır" ETİKETLEMESİ için
 * kullanılır (rozet göstermek üzere), filtre için değil.
 */
async function getInvestmentTransactionIds(
  supabase: SupabaseClient,
  bookId: string
): Promise<Set<string>> {
  const { data: portfolios, error: pErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("book_id", bookId);
  if (pErr) throw pErr;
  if (!portfolios || portfolios.length === 0) return new Set();

  const { data: holdings, error: hErr } = await supabase
    .from("holdings")
    .select("id")
    .in(
      "portfolio_id",
      portfolios.map((p) => p.id)
    );
  if (hErr) throw hErr;
  if (!holdings || holdings.length === 0) return new Set();

  const { data: holdingTx, error: htErr } = await supabase
    .from("holding_transactions")
    .select("transaction_id")
    .in(
      "holding_id",
      holdings.map((h) => h.id)
    );
  if (htErr) throw htErr;

  return new Set((holdingTx ?? []).map((h) => h.transaction_id));
}

interface RawTransferEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  amount_cents: number;
  book_id: string;
  accounts: { name: string } | { name: string }[] | null;
  books: { space: { id: string; name: string; type: string } | { id: string; name: string; type: string }[] | null } | { space: { id: string; name: string; type: string } | { id: string; name: string; type: string }[] | null }[] | null;
}

/**
 * "Ana işlem listesinde aynı transaction_id altındaki transfer entry'leri
 * TEK bir satırda birleştir; negatif/pozitif iki ayrı satır gösterme."
 *
 * ÖNEMLİ: transaction_entries ve bakiye hesaplama mantığı HİÇ
 * DEĞİŞMEDİ — bu yalnızca GÖRÜNTÜLEME katmanında, veritabanından zaten
 * gelen iki satırı TEK bir görsel satıra indirger.
 *
 * Sorgu, verilen transaction_id'ler için TÜM görünür entry'leri
 * (book_id filtresi OLMADAN) çeker — RLS zaten yalnızca kullanıcının
 * üye olduğu defterlerin satırlarını döndürür. Bu sayede:
 *  - Aynı defter içi transfer: RLS iki entry'yi de döner (aynı defter,
 *    zaten üye) → gerçek iki hesap adı gösterilir.
 *  - Cross-book transfer, kullanıcı HER İKİ deftere de üye: iki entry
 *    de döner → gerçek alan+hesap adları gösterilir.
 *  - Cross-book transfer, kullanıcı yalnızca BİR deftere üye: RLS
 *    yalnızca o tarafı döner → karşı taraf null (UI'de "Başka bir alan"
 *    gibi genel bir ifadeyle gösterilir), NOT/tutar/kullanıcı bilgisi
 *    KESİNLİKLE sızdırılmaz çünkü o satır hiç sorgulanan veri kümesinde
 *    yer almaz.
 */
async function attachTransferInfo(
  supabase: SupabaseClient,
  rows: { entryId: string; transactionId: string; type: string; accountId: string; accountName: string; amountCents: number }[]
): Promise<Map<string, { entries: { entryId: string; accountId: string; accountName: string; amountCents: number; bookId: string; spaceId: string; spaceName: string; spaceType: string }[] }>> {
  const transferTxIds = Array.from(new Set(rows.filter((r) => r.type === "transfer").map((r) => r.transactionId)));
  const result = new Map<
    string,
    { entries: { entryId: string; accountId: string; accountName: string; amountCents: number; bookId: string; spaceId: string; spaceName: string; spaceType: string }[] }
  >();
  if (transferTxIds.length === 0) return result;

  const { data, error } = await supabase
    .from("transaction_entries")
    .select("id, transaction_id, account_id, amount_cents, book_id, accounts(name), books(space:spaces(id, name, type))")
    .in("transaction_id", transferTxIds);
  if (error) throw error;

  for (const raw of (data ?? []) as unknown as RawTransferEntry[]) {
    const account = one(raw.accounts);
    const book = one(raw.books);
    const space = book ? one(book.space) : null;
    const entry = {
      entryId: raw.id,
      accountId: raw.account_id,
      accountName: account?.name ?? "—",
      amountCents: raw.amount_cents,
      bookId: raw.book_id,
      spaceId: space?.id ?? "",
      spaceName: space?.name ?? "",
      spaceType: space?.type ?? "",
    };
    const bucket = result.get(raw.transaction_id) ?? { entries: [] };
    bucket.entries.push(entry);
    result.set(raw.transaction_id, bucket);
  }

  return result;
}

/**
 * pageRows içindeki transfer satırlarını, aynı transaction_id'ye sahip
 * ikinci satırı DIŞARIDA bırakarak TEK satıra indirger ve `transfer`
 * alanını doldurur. income/expense satırları OLDUĞU GİBİ kalır.
 */
async function mergeTransferRows(
  supabase: SupabaseClient,
  rows: TransactionHistoryRow[]
): Promise<TransactionHistoryRow[]> {
  const transferMap = await attachTransferInfo(supabase, rows);
  const seenTransactionIds = new Set<string>();
  const merged: TransactionHistoryRow[] = [];

  for (const row of rows) {
    if (row.type !== "transfer") {
      merged.push(row);
      continue;
    }
    if (seenTransactionIds.has(row.transactionId)) {
      continue; // bu transaction_id için zaten bir satır eklendi (aynı defter içi ikinci bacak)
    }
    seenTransactionIds.add(row.transactionId);

    const bucket = transferMap.get(row.transactionId);
    const entries = bucket?.entries ?? [];
    const fromEntry = entries.find((e) => e.amountCents < 0);
    const toEntry = entries.find((e) => e.amountCents > 0);
    const crossBook = Boolean(fromEntry && toEntry && fromEntry.bookId !== toEntry.bookId);

    merged.push({
      ...row,
      amountCents: Math.abs(row.amountCents), // "tutar nötr gösterilsin" — işaret yok
      transfer: {
        fromAccountName: fromEntry?.accountName ?? null,
        toAccountName: toEntry?.accountName ?? null,
        fromSpaceName: crossBook ? (fromEntry?.spaceName ?? null) : null,
        toSpaceName: crossBook ? (toEntry?.spaceName ?? null) : null,
        crossBook,
      },
    });
  }

  return merged;
}

/**
 * Veresiye satış / vadeli alış TEMSİLİ satırları — bunlar GERÇEK
 * transaction_entries KAYDI DEĞİLDİR (henüz hiçbir hesap hareketi
 * oluşmamıştır, bkz. madde 2), debts tablosundan (metadata.business_kind
 * ile) türetilir. accountId filtresi bu satırlara UYGULANMAZ (hiçbir
 * hesapla ilişkili değiller) — yalnızca kind/status/tarih/arama
 * filtreleri geçerlidir.
 */
async function getCreditBusinessRows(
  supabase: SupabaseClient,
  bookId: string,
  filters: TransactionFilters
): Promise<TransactionHistoryRow[]> {
  const { kind = "all", status = "active", dateFrom, dateTo, search, accountId } = filters;

  // Bir hesaba göre filtrelenmişse, veresiye kayıtların hiçbiri hiçbir
  // hesaba bağlı OLMADIĞI için bu görünümde YER ALMAMALIDIR.
  if (accountId) return [];
  if (kind !== "all" && kind !== "income" && kind !== "expense") return [];

  let query = supabase
    .from("debts")
    .select("id, counterparty_name, direction, principal_cents, due_date, note, status, created_at, metadata, customer_id, supplier_id")
    .eq("book_id", bookId);

  if (status === "cancelled") query = query.eq("status", "cancelled");
  else if (status === "active") query = query.neq("status", "cancelled");
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
  if (search && search.trim()) query = query.ilike("note", `%${search.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows: TransactionHistoryRow[] = [];
  for (const d of data ?? []) {
    const meta = (d.metadata as Record<string, unknown> | null) ?? {};
    const businessKind = meta.business_kind as "sale" | "purchase" | undefined;
    if (businessKind !== "sale" && businessKind !== "purchase") continue;

    const asType: "income" | "expense" = businessKind === "sale" ? "income" : "expense";
    if (kind !== "all" && kind !== asType) continue;

    rows.push({
      entryId: `debt:${d.id}`,
      transactionId: `debt:${d.id}`,
      type: asType,
      isInvestment: false,
      status: d.status === "cancelled" ? "cancelled" : "active",
      amountCents: businessKind === "sale" ? d.principal_cents : -d.principal_cents,
      currency: "TRY",
      note: d.note,
      occurredAt: d.created_at,
      accountId: "",
      accountName: businessKind === "sale" ? "Tahsil edilecek" : "Ödenecek",
      categoryId: null,
      categoryName: null,
      businessKind,
      creditDebtId: d.id,
      counterpartyName: d.counterparty_name,
      dueDate: d.due_date,
    });
  }
  return rows;
}

export async function getTransactionHistory(
  supabase: SupabaseClient,
  bookId: string,
  filters: TransactionFilters = {}
): Promise<{ rows: TransactionHistoryRow[]; hasMore: boolean }> {
  const { kind = "all", accountId, categoryId, dateFrom, dateTo, search, status = "active" } = filters;
  const limit = filters.limit ?? 30;
  const offset = filters.offset ?? 0;

  let investmentIds: Set<string> | null = null;
  if (kind === "investment") {
    investmentIds = await getInvestmentTransactionIds(supabase, bookId);
    if (investmentIds.size === 0) return { rows: [], hasMore: false };
  }

  let query = supabase
    .from("transaction_entries")
    .select(
      "id, transaction_id, amount_cents, currency, note, account_id, category_id, accounts(name), categories(name), transactions!inner(id, type, status, occurred_at, metadata)"
    )
    .eq("book_id", bookId);

  if (accountId) query = query.eq("account_id", accountId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (search && search.trim()) query = query.ilike("note", `%${search.trim()}%`);

  if (kind === "investment" && investmentIds) {
    query = query.in("transaction_id", Array.from(investmentIds));
  } else if (kind !== "all") {
    query = query.eq("transactions.type", kind);
  }

  if (status !== "all") {
    query = query.eq("transactions.status", status);
  }

  if (dateFrom) query = query.gte("transactions.occurred_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("transactions.occurred_at", `${dateTo}T23:59:59`);

  // NOT: created_at'e göre sıralanır (occurred_at'e değil) — PostgREST'in
  // gömülü kaynak (transactions) kolonuna göre sıralaması güvenilir
  // desteklenmiyor; bkz. dashboard/queries.ts'teki aynı bilinen sınır.
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawEntryRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Diğer türler (income/expense/transfer, 'all' dahil) için de yatırım
  // rozeti gösterebilmek üzere, bu SAYFADAKİ transaction_id'lerin
  // yatırımla ilişkili olup olmadığını kontrol et.
  if (investmentIds === null && kind !== "transfer") {
    const txIds = pageRows.map((r) => one(r.transactions)?.id).filter((id): id is string => Boolean(id));
    if (txIds.length > 0) {
      const { data: holdingTx } = await supabase
        .from("holding_transactions")
        .select("transaction_id")
        .in("transaction_id", txIds);
      investmentIds = new Set((holdingTx ?? []).map((h) => h.transaction_id));
    } else {
      investmentIds = new Set();
    }
  }

  const finalInvestmentIds = investmentIds ?? new Set<string>();

  const mappedRows: TransactionHistoryRow[] = pageRows.map((r) => {
    const tx = one(r.transactions);
    const account = one(r.accounts);
    const category = one(r.categories);
    return {
      entryId: r.id,
      transactionId: r.transaction_id,
      type: (tx?.type as "income" | "expense" | "transfer") ?? "expense",
      isInvestment: tx ? finalInvestmentIds.has(tx.id) : false,
      status: (tx?.status as "active" | "cancelled") ?? "active",
      amountCents: r.amount_cents,
      currency: r.currency,
      note: r.note,
      occurredAt: tx?.occurred_at ?? "",
      accountId: r.account_id,
      accountName: account?.name ?? "—",
      categoryId: r.category_id,
      categoryName: category?.name ?? null,
      businessKind: (tx?.metadata as Record<string, unknown> | undefined)?.business_kind as
        | "sale"
        | "purchase"
        | "expense"
        | undefined,
    };
  });

  const merged = await mergeTransferRows(supabase, mappedRows);

  // Madde 2: veresiye satış/vadeli alış GERÇEK bir entry ÜRETMEDİĞİ için
  // yukarıdaki sorguda hiç görünmez — debts'ten AYRICA çekilip birleştirilir.
  const creditRows = await getCreditBusinessRows(supabase, bookId, filters);
  const combined = [...merged, ...creditRows].sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
  const limited = combined.slice(0, limit);

  return {
    hasMore: hasMore || combined.length > limit,
    rows: limited,
  };
}

export interface TransactionDetail extends TransactionHistoryRow {
  createdAt: string;
  cancelledAt: string | null;
}

/**
 * Tek bir işlemin detayını döner. Cross-book bir transferin karşı
 * tarafındaki entry, kullanıcı o defterin üyesi DEĞİLSE RLS nedeniyle
 * burada da GÖRÜNMEZ — bu ekran yalnızca kullanıcının erişimi olan
 * entry'yi (kendi book_id'sindeki bacağı) gösterir, diğer tarafı hiç
 * sorgulamaz.
 */
export async function getTransactionEntryDetail(
  supabase: SupabaseClient,
  entryId: string
): Promise<TransactionDetail | null> {
  const { data, error } = await supabase
    .from("transaction_entries")
    .select(
      "id, transaction_id, amount_cents, currency, note, account_id, category_id, created_at, accounts(name), categories(name), transactions!inner(id, type, status, occurred_at, created_at, cancelled_at)"
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as RawEntryRow & { created_at: string };
  const tx = one(row.transactions) as
    | { id: string; type: string; status: string; occurred_at: string; created_at: string; cancelled_at: string | null }
    | null;
  const account = one(row.accounts);
  const category = one(row.categories);

  if (!tx) return null;

  const { data: holdingTx } = await supabase
    .from("holding_transactions")
    .select("transaction_id")
    .eq("transaction_id", tx.id)
    .maybeSingle();

  let transfer: TransferInfo | undefined;
  let amountCents = row.amount_cents;
  if (tx.type === "transfer") {
    const bucket = await attachTransferInfo(supabase, [
      { entryId: row.id, transactionId: row.transaction_id, type: "transfer", accountId: row.account_id, accountName: account?.name ?? "—", amountCents: row.amount_cents },
    ]);
    const entries = bucket.get(row.transaction_id)?.entries ?? [];
    const fromEntry = entries.find((e) => e.amountCents < 0);
    const toEntry = entries.find((e) => e.amountCents > 0);
    const crossBook = Boolean(fromEntry && toEntry && fromEntry.bookId !== toEntry.bookId);
    transfer = {
      fromAccountName: fromEntry?.accountName ?? null,
      toAccountName: toEntry?.accountName ?? null,
      fromSpaceName: crossBook ? (fromEntry?.spaceName ?? null) : null,
      toSpaceName: crossBook ? (toEntry?.spaceName ?? null) : null,
      crossBook,
    };
    amountCents = Math.abs(row.amount_cents); // "tutar nötr gösterilsin"
  }

  return {
    entryId: row.id,
    transactionId: row.transaction_id,
    type: tx.type as "income" | "expense" | "transfer",
    isInvestment: Boolean(holdingTx),
    status: tx.status as "active" | "cancelled",
    amountCents,
    currency: row.currency,
    note: row.note,
    occurredAt: tx.occurred_at,
    accountId: row.account_id,
    accountName: account?.name ?? "—",
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    createdAt: tx.created_at,
    cancelledAt: tx.cancelled_at,
    transfer,
  };
}
