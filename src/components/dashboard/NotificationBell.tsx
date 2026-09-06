"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getNotifications, type NotificationRow } from "@/lib/dashboard/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/api/notifications-rpc";
import { formatRelativeDate } from "@/lib/format/date";
import { BellIcon, ClockIcon, PieChartIcon, TransferIcon, BuildingIcon } from "@/components/icons";
import { CardEmptyState } from "@/components/dashboard/DashboardCard";

const TYPE_ICON = {
  debt_due: ClockIcon,
  budget_80: PieChartIcon,
  budget_exceeded: PieChartIcon,
  transfer_created: TransferIcon,
  space_invite: BuildingIcon,
} as const;

const TYPE_TINT = {
  debt_due: "bg-warning-soft text-warning",
  budget_80: "bg-warning-soft text-warning",
  budget_exceeded: "bg-danger-soft text-danger",
  transfer_created: "bg-accent-soft text-accent",
  space_invite: "bg-accent-soft text-accent",
} as const;

const PREVIEW_LIMIT = 5;

/**
 * "Gerçek okunmamış bildirim yoksa sahte badge gösterilmemeli" — badge
 * yalnızca unreadCount > 0 iken render edilir. Balon içeriği TEMBEL
 * yüklenir (yalnızca açıldığında getNotifications çağrılır) — bu sayede
 * bileşeni kullanan 7 sayfanın (home/accounts/transactions/debts/
 * reports/customers/suppliers) HİÇBİRİNİN sunucu sorgusu DEĞİŞMEDİ, tek
 * bir bileşen güncellemesi hepsine yansıdı (kod tekrarı yok).
 *
 * Navigasyon deseni: ProfileMenu/SpaceSwitcher/BottomNav ile AYNI kök
 * neden düzeltmesini izler — GERÇEK bir navigasyon (bildirime/"Tümünü
 * gör"e tıklama) ASLA history.back() ile AYNI ANDA çalışmaz; yalnızca
 * dışarı tıklama/Escape/geri tuşu KAPATMASI history.back() kullanır.
 */
export function NotificationBell({ unreadCount: initialUnreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSpace = searchParams.get("space");

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pushedHistoryRef = useRef(false);

  /** Navigasyon OLMAYAN kapatma (dışarı tıklama/Escape/geri tuşu). */
  function dismiss() {
    if (pushedHistoryRef.current) {
      window.history.back();
    } else {
      setOpen(false);
    }
  }

  /** GERÇEK navigasyon — history.back() ile ASLA aynı anda çalışmaz. */
  function navigateTo(href: string) {
    if (pushedHistoryRef.current) {
      window.history.replaceState(null, "");
      pushedHistoryRef.current = false;
    }
    setOpen(false);
    router.push(href);
  }

  useEffect(() => {
    function handlePopState() {
      pushedHistoryRef.current = false;
      setOpen(false);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function loadPreview() {
    let cancelled = false;
    const supabase = createClient();
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setLoadError(false);
        return getNotifications(supabase, { limit: PREVIEW_LIMIT });
      })
      .then((rows) => {
        if (!cancelled && rows) setNotifications(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ notificationBellOpen: true }, "");
    pushedHistoryRef.current = true;

    const cancelLoad = loadPreview();

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) dismiss();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelLoad();
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleNotificationClick(n: NotificationRow) {
    const isUnread = !n.readAt;
    if (isUnread) {
      const supabase = createClient();
      const { error } = await markNotificationRead(supabase, n.id);
      if (!error) {
        setNotifications((prev) => prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    }

    if (n.entityType === "transaction_entry" && n.entityId) {
      const space = currentSpace ?? n.spaceId ?? "";
      navigateTo(`/transactions/${n.entityId}${space ? `?space=${space}` : ""}`);
    }
    // Yönlendirilecek bir detay yoksa yalnızca okundu işaretlenir, balon açık kalır.
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const supabase = createClient();
    const { error } = await markAllNotificationsRead(supabase);
    setMarkingAll(false);
    if (!error) {
      setNotifications((prev) => prev?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
      setUnreadCount(0);
      router.refresh();
    }
  }

  const hasUnreadInPreview = (notifications ?? []).some((n) => !n.readAt);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : "Bildirimler"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary"
      >
        <BellIcon size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bildirim önizlemesi"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-50 max-h-[70dvh] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-text-primary">Bildirimler</p>
            {hasUnreadInPreview ? (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs font-semibold text-accent disabled:opacity-40"
              >
                {markingAll ? "İşaretleniyor..." : "Tümünü okundu işaretle"}
              </button>
            ) : null}
          </div>

          <div className="max-h-[50dvh] overflow-y-auto p-2">
            {loading ? (
              <p className="py-6 text-center text-xs text-text-muted">Yükleniyor...</p>
            ) : loadError ? (
              <p className="py-6 text-center text-xs text-danger">Bildirimler yüklenemedi.</p>
            ) : !notifications || notifications.length === 0 ? (
              <CardEmptyState message="Henüz bildirimin yok." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {notifications.map((n) => {
                  const isUnread = !n.readAt;
                  const Icon = TYPE_ICON[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-muted ${
                        isUnread ? "bg-accent-soft/40" : ""
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TYPE_TINT[n.type]}`}>
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary">{n.title}</span>
                          {isUnread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Okunmadı" /> : null}
                        </span>
                        {n.body ? <span className="mt-0.5 block truncate text-xs text-text-secondary">{n.body}</span> : null}
                        <span className="mt-0.5 block text-[10px] text-text-muted">{formatRelativeDate(n.createdAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => navigateTo(currentSpace ? `/notifications?space=${currentSpace}` : "/notifications")}
            className="block w-full border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-accent"
          >
            Tüm bildirimleri gör
          </button>
        </div>
      ) : null}
    </div>
  );
}
