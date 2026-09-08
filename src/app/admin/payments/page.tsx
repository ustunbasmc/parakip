import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminPaymentActions } from "@/components/admin/AdminPaymentActions";

const PLAN_LABEL = { home_premium: "Ev Premium", business: "İşletme Premium" };
const PERIOD_LABEL = { monthly: "Aylık", yearly: "Yıllık" };

export default async function AdminPaymentsPage() {
  const supabase = getAdminDbClient();

  const { data: pending } = await supabase
    .from("manual_payment_requests")
    .select("id, user_id, plan, space_id, period, amount_cents, reference_code, created_at, profiles(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: recent } = await supabase
    .from("manual_payment_requests")
    .select("id, plan, period, amount_cents, reference_code, status, reviewed_at")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-text-primary">Banka Havalesi Ödeme Talepleri</h1>
        <p className="mt-1 text-sm text-text-muted">
          Banka hesap hareketlerini kontrol edip referans kodunu eşleştirdikten sonra onayla/reddet.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Bekleyen ({pending?.length ?? 0})</p>
        {!pending || pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-4 text-center text-sm text-text-muted">
            Bekleyen talep yok.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((r) => {
              const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              return (
                <div key={r.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {profile?.display_name || "İsimsiz"} — {PLAN_LABEL[r.plan as keyof typeof PLAN_LABEL]} (
                      {PERIOD_LABEL[r.period as keyof typeof PERIOD_LABEL]})
                    </p>
                    <p className="text-xs text-text-muted">
                      {(r.amount_cents / 100).toFixed(2)} ₺ · Referans:{" "}
                      <strong className="text-text-primary">{r.reference_code}</strong> ·{" "}
                      {new Date(r.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <AdminPaymentActions requestId={r.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Son işlemler</p>
        <div className="flex flex-col gap-2">
          {(recent ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted p-3.5">
              <span className="text-sm text-text-secondary">
                {PLAN_LABEL[r.plan as keyof typeof PLAN_LABEL]} · {r.reference_code}
              </span>
              <span className={`text-xs font-bold ${r.status === "approved" ? "text-success" : "text-danger"}`}>
                {r.status === "approved" ? "Onaylandı" : "Reddedildi"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
