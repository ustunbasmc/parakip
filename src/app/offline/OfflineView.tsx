"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import {
  clearOfflineSnapshots,
  hasSessionCookie,
  isOfflineSnapshotEnabled,
  readOfflineSnapshot,
  type OfflineSnapshot,
  type SnapshotSpace,
} from "@/lib/offline/snapshotStore";
import { RetryButton } from "./RetryButton";

type State = { kind: "loading" } | { kind: "none" } | { kind: "ready"; snapshot: OfflineSnapshot };

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const dueFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Oturum sahibini ağ olmadan bul; bulunamazsa kopya gösterilmez. */
async function resolveUserId(): Promise<string | null> {
  if (!hasSessionCookie()) return null;
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function loadSnapshot(): Promise<OfflineSnapshot | null> {
  if (!isOfflineSnapshotEnabled()) return null;
  if (!hasSessionCookie()) {
    // Çıkış yapılmış (başka sekmede de olabilir): cihazdaki kopya silinir.
    await clearOfflineSnapshots();
    return null;
  }
  const userId = await resolveUserId();
  if (!userId) return null;
  const snap = await readOfflineSnapshot(userId);
  if (!snap) await clearOfflineSnapshots(); // başka kullanıcıya ait kopya kalmasın
  return snap;
}

function sumLabel(list: { currency: string; cents: number }[]) {
  if (list.length === 0) return formatCentsAsCurrency(0, "TRY");
  return list.map((a) => formatCentsAsCurrency(a.cents, a.currency)).join(" · ");
}

function SpaceView({ space }: { space: SnapshotSpace }) {
  const active = space.accounts.filter((a) => !a.isArchived);
  const totals = new Map<string, number>();
  for (const a of active) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.balanceCents);

  const card = "rounded-2xl border border-border bg-surface p-4";
  const h = "mb-3 text-sm font-bold text-text-primary";

  return (
    <div className="flex flex-col gap-3">
      <section className={card}>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Toplam bakiye</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-text-primary">
          {totals.size === 0 ? formatCentsAsCurrency(0, "TRY") : [...totals].map(([c, v]) => formatCentsAsCurrency(v, c)).join(" · ")}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-income-soft px-3 py-2">
            <p className="text-text-muted">Bu ay gelir</p>
            <p className="font-bold tabular-nums text-income">{sumLabel(space.monthIncome)}</p>
          </div>
          <div className="rounded-xl bg-expense-soft px-3 py-2">
            <p className="text-text-muted">Bu ay gider</p>
            <p className="font-bold tabular-nums text-expense">{sumLabel(space.monthExpense.map((e) => ({ ...e, cents: Math.abs(e.cents) })))}</p>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={h}>Hesaplar</h2>
        {active.length === 0 ? (
          <p className="text-sm text-text-muted">Hesap yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {active.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-text-primary">{a.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-text-primary">{formatCentsAsCurrency(a.balanceCents, a.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className={h}>Son işlemler</h2>
        {space.transactions.length === 0 ? (
          <p className="text-sm text-text-muted">İşlem yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {space.transactions.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{t.note || (t.type === "income" ? "Gelir" : t.type === "expense" ? "Gider" : "Transfer")}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {shortDate.format(new Date(t.occurredAt))}
                    {t.accountName ? ` · ${t.accountName}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${t.amountCents >= 0 ? "text-income" : "text-expense"}`}>
                  {formatCentsAsCurrency(t.amountCents, t.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {space.budgets.length > 0 ? (
        <section className={card}>
          <h2 className={h}>Bu ayın bütçeleri</h2>
          <ul className="flex flex-col gap-3">
            {space.budgets.map((b, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-text-primary">{b.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {formatCentsAsCurrency(b.usedCents, "TRY")} / {formatCentsAsCurrency(b.budgetCents, "TRY")}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full ${b.alertLevel === "exceeded" ? "bg-danger" : b.alertLevel === "warning_80" ? "bg-warning" : "bg-accent"}`}
                    style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {space.debts.length > 0 ? (
        <section className={card}>
          <h2 className={h}>Açık borç / alacak</h2>
          <ul className="flex flex-col divide-y divide-border">
            {space.debts.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{d.counterpartyName}</span>
                  <span className="block text-xs text-text-muted">
                    {d.direction === "receivable" ? "Alacak" : "Borç"}
                    {d.dueDate ? ` · vade ${dueFmt.format(new Date(`${d.dueDate}T00:00:00Z`))}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${d.direction === "receivable" ? "text-income" : "text-expense"}`}>
                  {formatCentsAsCurrency(d.remainingCents, "TRY")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Çevrimdışı salt okunur görünüm. Kopya yoksa (hiç alınmamış, özellik
 * kapalı, çıkış yapılmış ya da başka kullanıcı) yalnızca bağlantı
 * mesajı gösterilir.
 */
export function OfflineView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSnapshot().then((snap) => {
      if (!alive) return;
      setState(snap ? { kind: "ready", snapshot: snap } : { kind: "none" });
      if (snap?.spaces[0]) setActiveId(snap.spaces[0].id);
    });
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      alive = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const header = (
    <span className="inline-flex items-center gap-2.5">
      {/* next/image yerine düz img: ikon service worker önbelleğinde (bkz. public/sw.js). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icon-192.png" alt="" width={30} height={30} className="rounded-[8px]" />
      <span className="text-lg font-extrabold tracking-tight text-text-primary">parakip</span>
    </span>
  );

  if (state.kind !== "ready") {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-12 text-center">
        {header}
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="text-xl font-extrabold text-text-primary">İnternet bağlantısı yok</h1>
          <p className="text-sm text-text-secondary">
            Parakip&apos;teki bilgilerin güvende; hesapların ve işlemlerin sunucuda saklanıyor. Bağlantın geri geldiğinde kaldığın
            yerden devam edebilirsin.
          </p>
        </div>
        <RetryButton />
        {state.kind === "none" ? (
          <p className="max-w-sm text-xs text-text-muted">
            Bu cihazda çevrimdışı görüntülenecek kayıt yok. Uygulamayı internetliyken açtığında özet bilgilerin bu cihaza kaydedilir.
          </p>
        ) : null}
      </main>
    );
  }

  const { snapshot } = state;
  const space = snapshot.spaces.find((s) => s.id === activeId) ?? snapshot.spaces[0];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-1 flex-col gap-4 bg-bg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        {header}
        <RetryButton compact label={online ? "Uygulamaya dön" : "Tekrar dene"} />
      </div>

      <div role="status" className="rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-xs text-warning">
        <p className="font-bold">{online ? "Bağlantı geri geldi" : "Çevrimdışı görünüm — salt okunur"}</p>
        <p className="mt-0.5">
          Son güncelleme: {dateTime.format(new Date(snapshot.savedAt))}. Bu tarihten sonraki değişiklikler burada görünmez; kayıt
          eklemek veya düzenlemek için internet gerekir.
        </p>
      </div>

      {snapshot.spaces.length > 1 ? (
        <nav className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 [scrollbar-width:none]">
          {snapshot.spaces.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              aria-pressed={s.id === space?.id}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${
                s.id === space?.id ? "bg-accent text-text-on-accent" : "text-text-secondary"
              }`}
            >
              {s.name}
            </button>
          ))}
        </nav>
      ) : null}

      {space ? <SpaceView space={space} /> : <p className="text-sm text-text-muted">Alan yok.</p>}
    </main>
  );
}
