"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "@/lib/api/notifications-rpc";
import { formatRelativeDate } from "@/lib/format/date";
import { ClockIcon, PieChartIcon, TransferIcon, BuildingIcon } from "@/components/icons";
import type { NotificationRow } from "@/lib/dashboard/notifications";

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

/**
 * "Bir bildirim açıldığında okundu olarak işaretlenmeli": tıklamada
 * mark_notification_read() çağrılır. entity_type='transaction_entry' ise
 * ilgili işlem detayına gidilir (mevcut RLS/gizlilik kuralları o sayfada
 * zaten geçerlidir — bkz. transactions/[id]/page.tsx); diğer türler için
 * (henüz ayrı bir borç/bütçe detay ekranı olmadığından) yalnızca okundu
 * işaretlenir, listede kalınır.
 */
export function NotificationListItem({ notification, spaceParam }: { notification: NotificationRow; spaceParam: string | null }) {
  const router = useRouter();
  const [readAt, setReadAt] = useState(notification.readAt);
  const [pending, setPending] = useState(false);
  const isUnread = !readAt;
  const Icon = TYPE_ICON[notification.type];

  async function handleClick() {
    if (pending) return;
    setPending(true);

    if (isUnread) {
      const supabase = createClient();
      const { error } = await markNotificationRead(supabase, notification.id);
      if (!error) {
        setReadAt(new Date().toISOString());
        router.refresh();
      }
    }

    setPending(false);

    if (notification.entityType === "transaction_entry" && notification.entityId) {
      const space = spaceParam ?? notification.spaceId ?? "";
      router.push(`/transactions/${notification.entityId}${space ? `?space=${space}` : ""}`);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors active:bg-surface-muted ${
        isUnread ? "border-accent/30 bg-accent-soft/40" : "border-border bg-surface"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_TINT[notification.type]}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-text-primary">{notification.title}</p>
          {isUnread ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Okunmadı" /> : null}
        </div>
        {notification.body ? <p className="mt-0.5 truncate text-xs text-text-secondary">{notification.body}</p> : null}
        <p className="mt-1 text-xs text-text-muted">{formatRelativeDate(notification.createdAt)}</p>
      </div>
    </button>
  );
}
