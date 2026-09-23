"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getMyPendingInvitations, type MyInvitation } from "@/lib/api/members-rpc";

/**
 * Yeni kayıt olan ve davet bekleyen kişi alan kurulum ekranına düşerse,
 * kendi alanını açmadan önce bekleyen davetini görebilsin.
 */
export function PendingInvitesNotice() {
  const [invites, setInvites] = useState<MyInvitation[]>([]);

  useEffect(() => {
    let alive = true;
    getMyPendingInvitations(createClient())
      .then((list) => {
        if (alive) setInvites(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (invites.length === 0) return null;
  const first = invites[0];
  return (
    <Link
      href={invites.length === 1 ? `/invite/${first.token}` : "/invitations"}
      className="flex flex-col gap-1 rounded-2xl border border-accent bg-accent-soft p-4 text-left"
    >
      <span className="text-sm font-bold text-text-primary">
        {invites.length === 1 ? `${first.inviterName} seni "${first.spaceName}" alanına davet etti` : `${invites.length} bekleyen davetin var`}
      </span>
      <span className="text-xs text-text-secondary">Kendi alanını açmadan önce daveti görüntüleyebilirsin →</span>
    </Link>
  );
}
