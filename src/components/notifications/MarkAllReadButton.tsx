"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsRead } from "@/lib/api/notifications-rpc";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    await markAllNotificationsRead(supabase);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="text-xs font-semibold text-accent disabled:opacity-40"
    >
      {loading ? "İşaretleniyor..." : "Tümünü okundu işaretle"}
    </button>
  );
}
