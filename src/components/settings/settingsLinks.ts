import {
  UserCircleIcon,
  StarIcon,
  BellIcon,
  ShieldIcon,
  HelpCircleIcon,
  BuildingIcon,
  LockIcon,
  TagIcon,
} from "@/components/icons";

export interface SettingsLinkItem {
  href: string;
  label: string;
  description: string;
  icon: typeof StarIcon;
  comingSoon?: boolean;
  /** Aktif alana göre içerik gösteren ekranlar için — URL'ye ?space= eklenir. */
  spaceAware?: boolean;
}

/** Ayar ekranlarının TEK listesi — profil menüsü ve /settings sayfası buradan beslenir. */
export const SETTINGS_LINKS: SettingsLinkItem[] = [
  { href: "/settings/profile", label: "Profil bilgilerim", description: "Ad, e-posta ve profil fotoğrafı", icon: UserCircleIcon },
  { href: "/settings/spaces", label: "Alanlarım", description: "Ev/İşletme alanlarını yönet", icon: BuildingIcon },
  { href: "/settings/plan", label: "Planım ve limitlerim", description: "Aktif alanın plan ve kullanım durumu", icon: StarIcon, spaceAware: true },
  { href: "/settings/categories", label: "Kategoriler", description: "Gelir/gider kategorilerini yönet", icon: TagIcon, spaceAware: true },
  { href: "/settings/security", label: "Güvenlik", description: "Şifre, oturumlar ve cihazlar", icon: ShieldIcon },
  { href: "/settings/account", label: "Hesap yönetimi", description: "Hesap silme talebi ve veri güvenliği", icon: LockIcon },
  { href: "/settings/notifications", label: "Bildirimler", description: "Hangi bildirimleri alacağını seç", icon: BellIcon },
  { href: "/help", label: "Yardım Merkezi", description: "Destek ve sık sorulanlar", icon: HelpCircleIcon },
];

export function settingsHref(item: SettingsLinkItem, space: string | null | undefined): string {
  return item.spaceAware && space ? `${item.href}?space=${space}` : item.href;
}
