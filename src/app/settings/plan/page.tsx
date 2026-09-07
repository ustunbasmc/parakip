import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { BuySubscriptionCard } from "@/components/settings/BuySubscriptionCard";
import { getUserSpacesBasic, resolveActiveSpace } from "@/lib/dashboard/formData";
import { getHomePlanInfo, getBusinessPlanInfo } from "@/lib/dashboard/plans";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; shopier_result?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/settings/plan?space=${activeSpace.id}`);
  }

  const shopierResult = params.shopier_result;

  const { data: spaceRow } = await supabase.from("spaces").select("owner_user_id").eq("id", activeSpace.id).maybeSingle();
  const ownerUserId = spaceRow?.owner_user_id ?? user.id;

  const isHome = activeSpace.type === "home";

  let homeInfo = null;
  let businessInfo = null;
  try {
    if (isHome) homeInfo = await getHomePlanInfo(supabase, activeSpace.bookId, ownerUserId);
    else businessInfo = await getBusinessPlanInfo(supabase, activeSpace.id, activeSpace.bookId);
  } catch {
    // Sessizce boş bırakılır — aşağıda hata durumu gösterilir.
  }

  return (
    <AppShell
      variant="subpage"
      title="Planım ve limitlerim"
      backFallbackHref="/home"
      activeSpaceType={activeSpace.type}
      headerEnd={
        <SpaceSwitcher options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
      }
    >
      <div className="flex flex-col gap-4 pt-3 pb-4">
        {shopierResult === "success" ? (
          <div className="rounded-2xl bg-accent-soft p-3.5 text-sm font-semibold text-accent">
            Ödemen alındı, İşletme aboneliğin aktif! 🎉
          </div>
        ) : shopierResult === "pending" ? (
          <div className="rounded-2xl bg-warning-soft p-3.5 text-sm font-semibold text-warning">
            Ödeme alındı, aboneliğin kısa süre içinde aktifleşecek.
          </div>
        ) : shopierResult === "error" ? (
          <div className="rounded-2xl bg-danger-soft p-3.5 text-sm font-semibold text-danger">
            Ödeme tamamlanamadı. Lütfen tekrar dene.
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Aktif alan</p>
          <p className="text-sm font-semibold text-text-primary">{activeSpace.name}</p>
        </div>

        {isHome ? (
          homeInfo ? (
            <>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">
                    {homeInfo.isPremium ? "Ev Premium" : "Ev Ücretsiz"}
                  </p>
                  {homeInfo.isPremium ? (
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">Aktif</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Premium kontrolü, alanın sahibine göre yapılır — sahip Premium ise tüm üyeler faydalanır.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="mb-2 text-sm font-semibold text-text-secondary">Hesap sayısı</p>
                {homeInfo.accountLimit === null ? (
                  <p className="text-sm text-text-primary">{homeInfo.accountCount} hesap · Sınırsız (Premium)</p>
                ) : (
                  <>
                    <p className="text-sm text-text-primary">
                      {homeInfo.accountCount} / {homeInfo.accountLimit} hesap kullanıldı
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${homeInfo.accountCount >= homeInfo.accountLimit ? "bg-danger" : "bg-accent"}`}
                        style={{ width: `${Math.min((homeInfo.accountCount / homeInfo.accountLimit) * 100, 100)}%` }}
                      />
                    </div>
                    {homeInfo.accountCount >= homeInfo.accountLimit ? (
                      <p className="mt-2 text-xs text-danger">
                        Hesap limitine ulaştın. Yeni hesap eklemek için Ev Premium&apos;e geçebilirsin.
                      </p>
                    ) : homeInfo.accountCount >= homeInfo.accountLimit - 1 ? (
                      <p className="mt-2 text-xs text-warning">Hesap limitine yaklaşıyorsun.</p>
                    ) : null}
                  </>
                )}
              </div>

              {!homeInfo.isPremium ? (
                ownerUserId === user.id ? (
                  <BuySubscriptionCard spaceId={activeSpace.id} plan="home_premium" />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-strong p-4 text-center">
                    <p className="text-sm font-semibold text-text-primary">Ev Premium</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Sınırsız hesap ve genişletilmiş özellikler. Yalnızca bu alanın sahibi satın alabilir.
                    </p>
                  </div>
                )
              ) : null}
            </>
          ) : (
            <p className="text-sm text-danger">Plan bilgisi yüklenemedi.</p>
          )
        ) : businessInfo ? (
          <>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">İşletme Paketi</p>
                {businessInfo.hasActiveSubscription ? (
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">Aktif</span>
                ) : (
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-muted">
                    Abonelik gerekli
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                İşletme aboneliği alan bazlıdır — bu alandaki tüm üyeler (sahip, yönetici, editör, görüntüleyici)
                aynı plana tabidir.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-3 text-sm font-semibold text-text-secondary">Kullanım ve limitler</p>
              <div className="flex flex-col gap-3">
                {businessInfo.limits.map((l) => (
                  <div key={l.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-primary">{l.label}</span>
                      <span className="text-text-secondary">
                        {l.limit === null ? `${l.used} · Sınırsız` : `${l.used} / ${l.limit}`}
                      </span>
                    </div>
                    {l.limit !== null ? (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${l.used >= l.limit ? "bg-danger" : "bg-accent"}`}
                          style={{ width: `${Math.min((l.used / l.limit) * 100, 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {!businessInfo.hasActiveSubscription ? <BuySubscriptionCard spaceId={activeSpace.id} plan="business" /> : null}
          </>
        ) : (
          <p className="text-sm text-danger">Plan bilgisi yüklenemedi.</p>
        )}
      </div>
    </AppShell>
  );
}
