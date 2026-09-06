import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Form dropdown'larını doldurmak için salt-okunur, RLS'e tabi yardımcılar.
 * dashboard/queries.ts ile aynı ilke: service_role yok, ekstra "yetki
 * kontrolü" kodu yok — RLS zaten yalnızca kullanıcının üye olduğu
 * defterlerin/hesapların görünmesini garanti eder.
 */

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export interface UserSpace {
  id: string;
  name: string;
  type: "home" | "business";
  bookId: string;
}

/** Kullanıcının erişebildiği tüm alanları (Ev + TÜM İşletmeler), her birinin kendi book_id'siyle döner. */
export async function getUserSpacesBasic(supabase: SupabaseClient): Promise<UserSpace[]> {
  const { data } = await supabase
    .from("spaces")
    .select("id, name, type, books(id)")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .map((s) => {
      const book = Array.isArray(s.books) ? s.books[0] : s.books;
      return book
        ? { id: s.id, name: s.name, type: s.type as "home" | "business", bookId: book.id }
        : null;
    })
    .filter((s): s is UserSpace => s !== null);
}

export interface ManagedSpace extends UserSpace {
  sector: string | null;
  isArchived: boolean;
  role: string;
}

/**
 * "Alanlarım" ekranı için — ARŞİVLENMİŞ alanlar DAHİL tüm alanları,
 * kullanıcının o alandaki rolüyle birlikte döner (düzenleme/arşivleme
 * butonlarının gösterilip gösterilmeyeceğine karar vermek için).
 */
export async function getManagedSpaces(supabase: SupabaseClient): Promise<ManagedSpace[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("spaces")
    .select("id, name, type, sector, is_archived, books(id), space_members!inner(role, user_id)")
    .eq("space_members.user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .map((s) => {
      const book = Array.isArray(s.books) ? s.books[0] : s.books;
      const membership = Array.isArray(s.space_members) ? s.space_members[0] : s.space_members;
      if (!book || !membership) return null;
      return {
        id: s.id,
        name: s.name,
        type: s.type as "home" | "business",
        bookId: book.id,
        sector: s.sector,
        isArchived: s.is_archived,
        role: membership.role,
      };
    })
    .filter((s): s is ManagedSpace => s !== null);
}

/**
 * URL'den gelen ?space=<id> değerine göre aktif alanı seçer. Kullanıcının
 * SAHİP OLMADIĞI bir id verilse bile (URL kurcalama), `spaces` dizisi
 * zaten yalnızca kullanıcının kendi RLS'e tabi alanlarını içerdiğinden
 * `find` hiçbir şey bulamaz ve sessizce ilk alana düşülür — RLS zaten
 * veri sızıntısını engeller, bu yalnızca doğru bir varsayılana düşmek
 * için ek bir uygulama seviyesi davranışıdır.
 */
export function resolveActiveSpace(spaces: UserSpace[], requestedId?: string): UserSpace {
  return (requestedId && spaces.find((s) => s.id === requestedId)) || spaces[0];
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface SpaceWithAccounts {
  spaceId: string;
  spaceName: string;
  spaceType: "home" | "business";
  bookId: string;
  accounts: AccountOption[];
}

/** Bir defterin (arşivlenmemiş) hesaplarını döner. */
export async function getAccountsForBook(
  supabase: SupabaseClient,
  bookId: string
): Promise<AccountOption[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, currency")
    .eq("book_id", bookId)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Bir defter için kullanılabilir (global + deftere özel) kategorileri döner. */
export async function getCategoriesForBook(
  supabase: SupabaseClient,
  bookId: string,
  kind: "income" | "expense"
): Promise<CategoryOption[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, book_id")
    .eq("kind", kind)
    .or(`book_id.is.null,book_id.eq.${bookId}`)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

/** Bir defter için TÜM (income+expense karışık) kategorileri döner — filtre dropdown'ı için. */
export async function getAllCategoriesForBook(
  supabase: SupabaseClient,
  bookId: string
): Promise<CategoryOption[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .or(`book_id.is.null,book_id.eq.${bookId}`)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Bir defterin TÜM (arşivli dahil) hesaplarını döner — filtre dropdown'ı için. */
export async function getAllAccountsForBook(
  supabase: SupabaseClient,
  bookId: string
): Promise<(AccountOption & { isArchived: boolean })[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, currency, is_archived")
    .eq("book_id", bookId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    isArchived: a.is_archived,
  }));
}
export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceCents: number;
  isArchived: boolean;
}

export async function getAccountsWithBalance(
  supabase: SupabaseClient,
  bookId: string,
  options: { archived?: boolean } = {}
): Promise<AccountWithBalance[]> {
  let query = supabase
    .from("account_balances")
    .select("account_id, name, type, currency, balance_cents, is_archived")
    .eq("book_id", bookId)
    .order("name", { ascending: true });

  if (options.archived !== undefined) {
    query = query.eq("is_archived", options.archived);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.account_id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    balanceCents: r.balance_cents,
    isArchived: r.is_archived,
  }));
}

/** Tek bir hesabı (bookId dahil, detay ekranı için) güncel bakiyesiyle döner. */
export async function getAccountWithBalance(
  supabase: SupabaseClient,
  accountId: string
): Promise<(AccountWithBalance & { bookId: string; note: string | null }) | null> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("account_id, book_id, name, type, currency, balance_cents, is_archived, note")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.account_id,
    bookId: data.book_id,
    name: data.name,
    type: data.type,
    currency: data.currency,
    balanceCents: data.balance_cents,
    isArchived: data.is_archived,
    note: data.note,
  };
}

/**
 * Kullanıcının bu defterdeki rolünü döner — "arşivleme yalnızca owner/admin"
 * kuralını ARAYÜZDE de yansıtmak (ör. butonu gizlemek) için. Asıl
 * yetkilendirme her zaman archive_account() içindedir; bu yalnızca UX'tir.
 */
export async function getUserRoleForBook(
  supabase: SupabaseClient,
  bookId: string
): Promise<string | null> {
  const { data: book } = await supabase.from("books").select("space_id").eq("id", bookId).maybeSingle();
  if (!book) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", book.space_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}

/**
 * Kullanıcının TÜM alanlarını, her birinin hesap listesiyle birlikte
 * döner — transfer formunda "aynı defter içi" VE "Ev-İşletme arası"
 * transferi tek bir hesap seçiciyle desteklemek için kullanılır.
 */
export async function getUserSpacesWithAccounts(
  supabase: SupabaseClient
): Promise<SpaceWithAccounts[]> {
  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id, name, type, books(id)")
    .order("created_at", { ascending: true });

  if (spacesError) throw spacesError;

  const withBooks = (spaces ?? [])
    .map((s) => {
      const book = Array.isArray(s.books) ? s.books[0] : s.books;
      return book
        ? { spaceId: s.id, spaceName: s.name, spaceType: s.type as "home" | "business", bookId: book.id }
        : null;
    })
    .filter((s): s is Omit<SpaceWithAccounts, "accounts"> => s !== null);

  const results: SpaceWithAccounts[] = [];
  for (const space of withBooks) {
    const accounts = await getAccountsForBook(supabase, space.bookId);
    results.push({ ...space, accounts });
  }
  return results;
}
