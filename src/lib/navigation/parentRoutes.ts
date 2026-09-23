/**
 * Hiyerarşik "yukarı" navigasyon — görünür geri butonu kullanıcıyı
 * tarayıcı geçmişindeki önceki sayfaya DEĞİL, bulunduğu ekranın
 * uygulamadaki ebeveyn rotasına götürür. Sayfa doğrudan URL ile açılmış
 * olsa bile sonuç aynıdır.
 *
 * Sayfa kendi ebeveynini açıkça (`parentHref`) verebilir; vermezse bu
 * tablo kullanılır. İlk eşleşen kural geçerlidir — özel kurallar genel
 * kurallardan ÖNCE yazılmalıdır.
 *
 * Cihazın fiziksel geri tuşu bu mekanizmadan etkilenmez (tarayıcı geçmişi
 * aynen çalışır).
 */
const PARENT_RULES: [RegExp, string][] = [
  // Borçlar: tekrarlayan ödemeler kendi alt ağacıdır.
  [/^\/debts\/recurring\/.+$/, "/debts/recurring"],
  [/^\/debts\/recurring$/, "/debts"],

  // Liste → detay/yeni kayıt
  [/^\/accounts\/.+$/, "/accounts"],
  [/^\/debts\/.+$/, "/debts"],
  [/^\/budgets\/.+$/, "/budgets"],
  [/^\/transactions\/.+$/, "/transactions"],
  [/^\/investments\/.+$/, "/investments"],
  [/^\/customers\/.+$/, "/customers"],
  [/^\/suppliers\/.+$/, "/suppliers"],

  // Yardım ve destek
  [/^\/help\/.+$/, "/help"],
  [/^\/support\/tickets\/.+$/, "/support/tickets"],
  [/^\/support(\/.*)?$/, "/help"],
  [/^\/help$/, "/home"],

  // Ayarlar
  [/^\/settings\/.+$/, "/settings"],

  // Admin
  [/^\/admin\/([^/]+)\/.+$/, "/admin/$1"],
  [/^\/admin\/.+$/, "/admin"],
  [/^\/admin$/, "/home"],
];

/** Aktif alana göre veri gösteren ebeveyn rotalar — geri dönerken ?space= korunur. */
const SPACE_AWARE_PARENTS = new Set([
  "/home",
  "/accounts",
  "/transactions",
  "/debts",
  "/debts/recurring",
  "/budgets",
  "/investments",
  "/reports",
  "/customers",
  "/suppliers",
  "/settings",
]);

export function getParentHref(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [pattern, parent] of PARENT_RULES) {
    if (pattern.test(path)) return path.replace(pattern, parent);
  }
  return "/home";
}

/**
 * Ebeveyn rota alan bazlıysa ve hedefte henüz bir sorgu yoksa, mevcut
 * URL'deki `space` parametresini taşır (kullanıcı başka bir alana
 * "düşmesin" diye).
 */
export function withSpaceParam(href: string, currentSearch: string): string {
  if (href.includes("?") || !SPACE_AWARE_PARENTS.has(href)) return href;
  const space = new URLSearchParams(currentSearch).get("space");
  return space ? `${href}?space=${encodeURIComponent(space)}` : href;
}
