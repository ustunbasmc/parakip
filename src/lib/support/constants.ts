/**
 * Destek sistemi sabitleri — hem client hem server tarafında kullanılır.
 * Değerler migration 0061'deki CHECK kısıtlarıyla BİREBİR aynı olmalıdır.
 */

export const TICKET_TYPES = ["bug", "feature", "account", "payment", "data", "other"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  bug: "Hata bildir",
  feature: "Özellik öner",
  account: "Hesap sorunları",
  payment: "Ödeme/abonelik sorunu",
  data: "Veri veya işlem sorunu",
  other: "Diğer",
};

export const TICKET_STATUSES = ["open", "in_review", "answered", "awaiting_user", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Açık",
  in_review: "İnceleniyor",
  answered: "Yanıtlandı",
  awaiting_user: "Yanıtın bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

/** Admin paneli için — kullanıcıya gösterilen etiketten farklı olarak durumu yöneticinin gözünden anlatır. */
export const TICKET_STATUS_ADMIN_LABELS: Record<TicketStatus, string> = {
  ...TICKET_STATUS_LABELS,
  awaiting_user: "Kullanıcı yanıtı bekleniyor",
};

export const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  open: "bg-accent-soft text-accent",
  in_review: "bg-warning-soft text-warning",
  answered: "bg-success-soft text-success",
  awaiting_user: "bg-warning-soft text-warning",
  resolved: "bg-surface-muted text-text-secondary",
  closed: "bg-surface-muted text-text-muted",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

/**
 * "Sorunun yaşandığı ekran" seçenekleri. `from` parametresiyle gelen yol
 * (ör. /budgets/123) en uzun eşleşen önekle bu listeden birine çevrilir.
 */
export const SCREEN_OPTIONS: { value: string; label: string }[] = [
  { value: "/home", label: "Ana sayfa" },
  { value: "/accounts", label: "Hesaplar" },
  { value: "/transactions", label: "Hareketler" },
  { value: "/add-transaction", label: "Gelir/gider ekleme" },
  { value: "/budgets", label: "Bütçeler" },
  { value: "/debts", label: "Borçlar ve alacaklar" },
  { value: "/investments", label: "Yatırımlar" },
  { value: "/reports", label: "Raporlar" },
  { value: "/customers", label: "Müşteriler" },
  { value: "/suppliers", label: "Tedarikçiler" },
  { value: "/sales", label: "Satış" },
  { value: "/purchases", label: "Alış" },
  { value: "/settings/categories", label: "Kategoriler" },
  { value: "/settings/plan", label: "Plan ve abonelik" },
  { value: "/settings/profile", label: "Profil" },
  { value: "/settings/security", label: "Güvenlik" },
  { value: "/settings/account", label: "Hesap yönetimi" },
  { value: "/settings/spaces", label: "Alanlarım" },
  { value: "/notifications", label: "Bildirimler" },
  { value: "/onboarding", label: "İlk kurulum" },
  { value: "other", label: "Diğer / bilmiyorum" },
];

export function screenLabel(value: string | null | undefined): string {
  if (!value) return "Belirtilmedi";
  return SCREEN_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Yalnızca uygulama içi, güvenli bir yolu SCREEN_OPTIONS'taki bir değere eşler. */
export function matchScreen(path: string | null | undefined): string {
  if (!path || !path.startsWith("/")) return "";
  const clean = path.split("?")[0];
  const match = SCREEN_OPTIONS.filter((o) => o.value.startsWith("/"))
    .filter((o) => clean === o.value || clean.startsWith(o.value + "/"))
    .sort((a, b) => b.value.length - a.value.length)[0];
  return match?.value ?? "";
}

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 140;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 5000;
export const MESSAGE_MAX = 5000;

export const ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** Bucket'taki file_size_limit (migration 0061) ile aynı. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const SUPPORT_BUCKET = "support-attachments";

export function validateAttachment(file: File): string | null {
  if (!ATTACHMENT_TYPES[file.type]) return "Yalnızca JPG, PNG veya WebP formatında bir görsel ekleyebilirsin.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "Görsel en fazla 5 MB olabilir.";
  return null;
}

export function isTicketType(value: unknown): value is TicketType {
  return typeof value === "string" && (TICKET_TYPES as readonly string[]).includes(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function formatTicketNumber(n: number | string): string {
  return `#${n}`;
}

/** Sunucu UTC'de çalıştığı için saat dilimi açıkça Türkiye olarak verilir. */
export function formatSupportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}
