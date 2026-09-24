import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: (active: boolean) => ReactNode;
}

/**
 * Tüm navigasyon öğelerinin TEK kaynağı — BottomNav (mobil), "Daha
 * Fazla" paneli ve Sidebar (masaüstü) buradan besleniyor, kod tekrarı
 * yok. Hepsi aktif alana göre veri gösterir (space parametresi korunur).
 */
export const HOME_ITEM: NavItem = {
  href: "/home",
  label: "Ana Sayfa",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5L12 4l8 7.5M6 9.5V20h12V9.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export const ACCOUNTS_ITEM: NavItem = {
  href: "/accounts",
  label: "Hesaplar",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8a2 2 0 012-2h13a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
      />
      <path d="M16 12.5h3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  ),
};

export const TRANSACTIONS_ITEM: NavItem = {
  href: "/transactions",
  label: "Hareketler",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.9}
        strokeLinecap="round"
      />
    </svg>
  ),
};

export const DEBTS_ITEM: NavItem = {
  href: "/debts",
  label: "Borçlar",
  description: "Borç, alacak, tahsilat ve tekrarlayan ödemeler",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path
        d="M12 8v8M9.5 10a2.5 2.5 0 012.5-1.5c1.4 0 2.5.8 2.5 2s-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2a2.5 2.5 0 002.5-1.5"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.5}
        strokeLinecap="round"
      />
    </svg>
  ),
};

export const REPORTS_ITEM: NavItem = {
  href: "/reports",
  label: "Raporlar",
  description: "Gelir-gider, kategori ve hesap bazlı analizler",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19V10M12 19V5M19 19v-6" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
      <path d="M3 19h18" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  ),
};

/** Henüz ayrı bir ekranı olmayan modüller — "Daha Fazla"da/sidebar'da "Yakında" olarak listelenir, tıklanamaz. */
export interface ComingSoonItem {
  label: string;
  description: string;
  icon: (active: boolean) => ReactNode;
}

export const BUDGETS_ITEM: NavItem = {
  href: "/budgets",
  label: "Bütçeler",
  description: "Aylık ve kategori bazlı bütçe takibi",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const GOALS_ITEM: NavItem = {
  href: "/goals",
  label: "Hedefler",
  description: "Tatil, araba, acil durum fonu gibi birikim hedefleri",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  ),
};

export const NET_WORTH_ITEM: NavItem = {
  href: "/net-worth",
  label: "Net Değer",
  description: "Varlıkların eksi borçların ve zaman içindeki değişimi",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  ),
};

export const INVESTMENTS_ITEM: NavItem = {
  href: "/investments",
  label: "Yatırımlar",
  description: "Portföy, alış/satış ve varlık takibi",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17l5-5 4 4 7-8" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const CUSTOMERS_ITEM: NavItem = {
  href: "/customers",
  label: "Müşteriler",
  description: "Yalnızca İşletme alanlarında — müşteri ve satış/alacak takibi",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M5.5 19.5c1.3-3.2 4-4.8 6.5-4.8s5.2 1.6 6.5 4.8" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  ),
};

export const SUPPLIERS_ITEM: NavItem = {
  href: "/suppliers",
  label: "Tedarikçiler",
  description: "Yalnızca İşletme alanlarında — tedarikçi ve alış/borç takibi",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="7" height="9" rx="1" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="14" y="6" width="7" height="13" rx="1" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M6.5 10V6.5a1 1 0 011-1h3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  ),
};

export const SPACES_ITEM: NavItem = {
  href: "/settings/spaces",
  label: "Alanlarım",
  description: "Ev/İşletme alanlarını, ekip üyelerini ve arşivi yönet",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="13" y="4" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="4" y="13" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="13" y="13" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
    </svg>
  ),
};

/** Alt navigasyonda/sidebar'da doğrudan görünen, en sık kullanılan üç ekran. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [HOME_ITEM, ACCOUNTS_ITEM, TRANSACTIONS_ITEM];

/** Mobilde "Daha Fazla" panelinde, masaüstünde sidebar'da doğrudan görünür — GERÇEK ekranı olanlar. */
export const MORE_NAV_ITEMS: NavItem[] = [DEBTS_ITEM, BUDGETS_ITEM, GOALS_ITEM, NET_WORTH_ITEM, INVESTMENTS_ITEM, REPORTS_ITEM, CUSTOMERS_ITEM, SUPPLIERS_ITEM, SPACES_ITEM];

/**
 * Müşteriler/Tedarikçiler yalnızca space.type='business' alanlarda
 * anlamlıdır — Ev alanındayken (veya alan türü bilinmiyorken, güvenli
 * taraf) menüden GİZLENİR. Sayfa seviyesinde zaten Ev için redirect
 * uygulanıyor (bkz. /customers, /suppliers) — bu yalnızca menüyü
 * tutarlı gösterir.
 */
export function getVisibleMoreItems(activeSpaceType: "home" | "business" | undefined): NavItem[] {
  if (activeSpaceType === "business") return MORE_NAV_ITEMS;
  return MORE_NAV_ITEMS.filter((item) => item.href !== CUSTOMERS_ITEM.href && item.href !== SUPPLIERS_ITEM.href);
}

/** Henüz ekranı olmayan, "Yakında" olarak gösterilecek modüller. */
/** Artık gerçek ekranı olmayan, hâlâ "Yakında" gösterilecek modül kalmadı — boş dizi korunuyor (gelecekte ihtiyaç olursa buraya eklenir). */
export const MORE_COMING_SOON_ITEMS: ComingSoonItem[] = [];

/** Yardım/destek öğeleri — `appendContext` true ise bulunulan ekran (from) ve aktif alan (space) talep formuna taşınır. */
export interface SupportNavItem extends NavItem {
  appendContext?: boolean;
}

export const SUPPORT_NAV_ITEMS: SupportNavItem[] = [
  {
    href: "/help",
    label: "Yardım Merkezi",
    description: "Rehberler ve sık sorulan sorular",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
        <path d="M9.6 9.5a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.6" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth={active ? 2.6 : 2.2} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/support/tickets",
    label: "Destek Taleplerim",
    description: "Taleplerini ve yanıtları takip et",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-4 4v-4h0A2 2 0 014 14V6.5z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/support/new?type=bug",
    label: "Hata Bildir",
    description: "Bir şey beklendiği gibi çalışmıyor mu?",
    appendContext: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/support/new?type=feature",
    label: "Özellik Öner",
    description: "Parakip'i birlikte geliştirelim",
    appendContext: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0012 3z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/** Destek öğesinin gerçek bağlantısı — gerekiyorsa bulunulan ekranı ve alanı ekler. */
export function supportHref(item: SupportNavItem, pathname: string, currentSpace: string | null): string {
  if (!item.appendContext) return item.href;
  const params = new URLSearchParams();
  if (pathname && !pathname.startsWith("/support") && !pathname.startsWith("/help")) params.set("from", pathname);
  if (currentSpace) params.set("space", currentSpace);
  const extra = params.toString();
  return extra ? `${item.href}&${extra}` : item.href;
}

/** Yardım/destek ekranlarından birinde mi? (menü vurgusu için) */
export function isSupportPath(pathname: string): boolean {
  return pathname === "/help" || pathname.startsWith("/help/") || pathname.startsWith("/support");
}

/** space parametresi taşınması GEREKEN tüm rotalar (aktif alana göre veri gösterirler). */
export const SPACE_AWARE_HREFS = new Set([
  HOME_ITEM.href,
  ACCOUNTS_ITEM.href,
  TRANSACTIONS_ITEM.href,
  DEBTS_ITEM.href,
  BUDGETS_ITEM.href,
  INVESTMENTS_ITEM.href,
  REPORTS_ITEM.href,
  CUSTOMERS_ITEM.href,
  SUPPLIERS_ITEM.href,
]);
