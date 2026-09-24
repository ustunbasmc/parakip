import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getUnreadNotificationCount } from "@/lib/dashboard/notifications";
import { getNetWorth, getNetWorthHistory } from "@/lib/dashboard/netWorth";
import { getProfileHeaderInfo } from "@/lib/avatars";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { zonedIsoDate } from "@/lib/format/tz";

/** Grafik için geriye dönük gün sayısı (en geniş aralık 6 ay). */
const HISTORY_DAYS = 190;

/** İstek anına göre geçmişin başlangıç tarihi (render dışında). */
function historySince(): string {
  return zonedIsoDate(new Date(Date.now() - HISTORY_DAYS * 86_400_000));
}

export default async function NetWorthPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const [profileHeader, spaces] = await Promise.all([getProfileHeaderInfo(supabase, user.id), getUserSpacesBasic(supabase)]);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) redirect(`/net-worth?space=${activeSpace.id}`);

  const [unreadCount, current, history] = await Promise.all([
    getUnreadNotificationCount(supabase).catch(() => 0),
    getNetWorth(supabase, activeSpace.bookId).catch(() => null),
    getNetWorthHistory(supabase, activeSpace.bookId, historySince()).catch(() => []),
  ]);

  const q = `space=${activeSpace.id}`;
  const rows = current
    ? [
        { label: "Hesaplar", cents: current.accountsCents, href: `/accounts?${q}` },
        { label: "Yatırımlar", cents: current.investmentsCents, href: `/investments?${q}` },
        { label: "Bekleyen alacaklar", cents: current.receivablesCents, href: `/debts?${q}` },
        { label: "Bekleyen borçlar", cents: -current.payablesCents, href: `/debts?${q}` },
      ]
    : [];

  return (
    <AppShell
      title="Net değer"
      activeSpaceType={activeSpace.type}
      headerEnd={
        <div className="flex items-center gap-2">
          <NotificationBell unreadCount={unreadCount} />
          <SpaceSwitcher options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
          <ProfileMenu displayName={profileHeader.displayName} email={user.email ?? null} avatarUrl={profileHeader.avatarUrl} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-4">
        {!current ? (
          <p className="py-6 text-center text-sm text-danger">Net değer hesaplanamadı. Lütfen tekrar dene.</p>
        ) : (
          <>
            <section
              aria-label="Net değer"
              className="animate-rise relative overflow-hidden rounded-3xl border p-5 sm:p-6"
              style={{
                backgroundImage: "var(--gradient-hero)",
                boxShadow: "var(--shadow-hero)",
                borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
              }}
            >
              <p className="text-sm font-semibold text-text-secondary">Net değer</p>
              <p
                className={`mt-2 text-[clamp(2rem,9vw,3.2rem)] font-extrabold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere] ${
                  current.netCents < 0 ? "text-expense" : "text-text-primary"
                }`}
              >
                {formatCentsAsCurrency(current.netCents, "TRY")}
              </p>
              <p className="mt-2 text-xs text-text-muted">Sahip oldukların ve alacakların, eksi borçların. Dövizler güncel kurla TL&apos;ye çevrilir.</p>

              <ul className="mt-4 flex flex-col gap-1 rounded-2xl bg-[var(--tile-bg)] p-2 backdrop-blur-sm">
                {rows.map((r) => (
                  <li key={r.label}>
                    <Link href={r.href} className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-muted/60">
                      <span className="truncate text-sm text-text-secondary">{r.label}</span>
                      <span
                        className={`shrink-0 whitespace-nowrap text-sm font-bold tabular-nums ${r.cents < 0 ? "text-expense" : "text-text-primary"}`}
                      >
                        {r.cents < 0 ? "−" : ""}
                        {formatCentsAsCurrency(Math.abs(r.cents), "TRY")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {current.unconverted.length > 0 ? (
                <p className="mt-3 text-xs text-text-muted">
                  Kuru bulunamadığı için dahil edilmeyen:{" "}
                  {current.unconverted.map((u) => formatCentsAsCurrency(u.cents, u.currency)).join(" · ")}
                </p>
              ) : null}
            </section>

            <DashboardCard title="Zaman içindeki değişim" subtitle="Her gün otomatik kaydedilir">
              <NetWorthChart points={history} />
            </DashboardCard>
          </>
        )}
      </div>
    </AppShell>
  );
}
