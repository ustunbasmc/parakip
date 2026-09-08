"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  UserCircleIcon,
  StarIcon,
  BellIcon,
  ShieldIcon,
  HelpCircleIcon,
  LogOutIcon,
  BuildingIcon,
  LockIcon,
  TagIcon,
} from "@/components/icons";
import { useThemePreference } from "@/lib/theme/ThemeSync";

interface ProfileMenuProps {
  displayName: string | null;
  email: string | null;
  avatarUrl?: string | null;
}

interface MenuLinkItem {
  href: string;
  label: string;
  description: string;
  icon: typeof StarIcon;
  comingSoon?: boolean;
  /** Aktif alana göre içerik gösteren ekranlar için — URL'ye ?space= eklenir. */
  spaceAware?: boolean;
}

const THEME_LABELS: Record<string, string> = { light: "Gündüz", dark: "Gece", system: "Sistem" };

const LINKS: MenuLinkItem[] = [
  { href: "/settings/profile", label: "Profil bilgilerim", description: "Ad, e-posta ve profil fotoğrafı", icon: UserCircleIcon },
  { href: "/settings/spaces", label: "Alanlarım", description: "Ev/İşletme alanlarını yönet", icon: BuildingIcon },
  { href: "/settings/plan", label: "Planım ve limitlerim", description: "Aktif alanın plan ve kullanım durumu", icon: StarIcon, spaceAware: true },
  { href: "/settings/categories", label: "Kategoriler", description: "Gelir/gider kategorilerini yönet", icon: TagIcon, spaceAware: true },
  { href: "/settings/security", label: "Güvenlik", description: "Şifre, oturumlar ve cihazlar", icon: ShieldIcon },
  { href: "/settings/account", label: "Hesap yönetimi", description: "Hesap silme talebi ve veri güvenliği", icon: LockIcon },
  { href: "/settings/notifications", label: "Bildirimler", description: "Bildirim tercihleri", icon: BellIcon, comingSoon: true },
  { href: "/settings/help", label: "Yardım", description: "Destek ve sık sorulanlar", icon: HelpCircleIcon, comingSoon: true },
];

/**
 * Sağ üst profil menüsü — Ayarlar artık alt navigasyonda ayrı bir sekme
 * DEĞİL, buradan erişiliyor. "Abonelik/Bildirimler/Güvenlik/Yardım" henüz
 * gerçek ekranları olmayan bölümler için dürüst bir "Yakında" rozeti
 * gösterir (tıklanınca hiçbir şey olmaz, sahte bir ekran açılmaz).
 *
 * Açma/kapama deseni SpaceSwitcher ile AYNI: dışarı tıklama, Escape ve
 * cihaz geri tuşu ile kapanır (geçici history girdisi + popstate).
 */
export function ProfileMenu({ displayName, email, avatarUrl }: ProfileMenuProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSpace = searchParams.get("space");

  function hrefFor(item: MenuLinkItem) {
    return item.spaceAware && currentSpace ? `${item.href}?space=${currentSpace}` : item.href;
  }
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedHistoryRef = useRef(false);

  /** Navigasyon OLMAYAN kapatma (dışarı tıklama/Escape). */
  function close() {
    if (pushedHistoryRef.current) {
      window.history.back();
    } else {
      setOpen(false);
    }
  }

  /**
   * KÖK NEDEN DÜZELTMESİ (v2): Önceki sürüm, gerçek bir link tıklamasında
   * BİLE history.back() → popstate → router.push zincirini kullanıyordu.
   * Bu zincir tarayıcının geri-navigasyon ZAMANLAMASINA bağımlıydı ve
   * nadiren (ör. "Planım ve limitlerim"e İşletme alanındayken tıklanınca)
   * router.push'un YANLIŞ/ESKİ bir URL ile tetiklenmesine, kullanıcının
   * bir an yanlış alanın içeriğini (Ev) görüp sonra düzelmesine yol
   * açıyordu. Çözüm: GERÇEK bir navigasyon (link tıklaması) ASLA
   * history.back() kullanmaz — yalnızca paneli SENKRON kapatır ve
   * DOĞRUDAN router.push(href) çağırır. history.back(), yalnızca
   * NAVİGASYON OLMAYAN kapatmalarda (dışarı tıklama/Escape) kullanılır;
   * bu durumda bile açılırken eklenen geçici history girdisi
   * replaceState ile SESSİZCE (hiçbir popstate/navigasyon tetiklemeden)
   * "normal" bir girdiye çevrilir — iki navigasyon ASLA aynı anda
   * yarışmaz.
   */
  function navigateTo(href: string) {
    if (pushedHistoryRef.current) {
      window.history.replaceState(null, "", window.location.href);
      pushedHistoryRef.current = false;
    }
    setOpen(false);
    router.push(href);
  }

  useEffect(() => {
    function handlePopState() {
      setOpen(false);
      pushedHistoryRef.current = false;
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ profileMenuOpen: true }, "");
    pushedHistoryRef.current = true;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    if (pushedHistoryRef.current) {
      window.history.replaceState(null, "", window.location.href);
      pushedHistoryRef.current = false;
    }
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/welcome");
    router.refresh();
  }

  const { theme } = useThemePreference();
  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profil menüsü"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-text-on-accent"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial || <UserCircleIcon size={20} />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-border bg-bg-elevated p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-2xl"
        >
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-border sm:hidden" aria-hidden="true" />

          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-base font-bold text-text-on-accent">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial || <UserCircleIcon size={22} />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{displayName || "Kullanıcı"}</p>
              {email ? <p className="truncate text-xs text-text-muted">{email}</p> : null}
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

          <Link
            href="/settings/theme"
            onClick={(e) => {
              e.preventDefault();
              navigateTo("/settings/theme");
            }}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-surface-muted"
          >
            <span className="text-sm font-medium text-text-primary">Tema</span>
            <span className="text-xs font-semibold text-text-muted">{theme ? THEME_LABELS[theme] ?? theme : "—"}</span>
          </Link>

          <div className="flex flex-col gap-0.5">
            {LINKS.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.href}
                  role="menuitem"
                  aria-disabled="true"
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-text-muted"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <item.icon size={17} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-text-muted">{item.description}</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold">Yakında</span>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={hrefFor(item)}
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(hrefFor(item));
                  }}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-muted"
                >
                  <item.icon size={17} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text-primary">{item.label}</span>
                    <span className="block truncate text-xs text-text-muted">{item.description}</span>
                  </span>
                </Link>
              )
            )}
          </div>

          <div className="my-1.5 border-t border-border" />

          <button
            onClick={handleSignOut}
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            <LogOutIcon size={17} />
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
