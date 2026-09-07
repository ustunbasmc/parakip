import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminCancelTransactionButton } from "@/components/admin/AdminCancelTransactionButton";

export default async function AdminSpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAdminDbClient();

  const { data: space } = await supabase.from("spaces").select("id, name, type, owner_user_id, created_at").eq("id", id).maybeSingle();
  if (!space) notFound();

  const { data: book } = await supabase.from("books").select("id").eq("space_id", id).maybeSingle();

  const [accounts, transactions, debts] = await Promise.all([
    book ? supabase.from("accounts").select("id, name, type, currency, opening_balance_cents, is_archived").eq("book_id", book.id) : Promise.resolve({ data: [] }),
    book
      ? supabase
          .from("transaction_entries")
          .select("id, amount_cents, currency, note, transactions!inner(id, type, status, occurred_at)")
          .eq("book_id", book.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    book ? supabase.from("debts").select("id, counterparty_name, direction, principal_cents, status").eq("book_id", book.id) : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-accent">
          ← Kullanıcılar
        </Link>
        <h1 className="mt-2 text-xl font-extrabold text-text-primary">{space.name}</h1>
        <p className="text-xs text-text-muted">
          {space.type === "home" ? "Ev" : "İşletme"} · Alan ID: {space.id}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Hesaplar</p>
        <div className="flex flex-col gap-2">
          {(accounts.data ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
              <span className="text-sm font-medium text-text-primary">
                {a.name} {a.is_archived ? <span className="text-xs text-text-muted">(arşivlenmiş)</span> : null}
              </span>
              <span className="text-xs text-text-muted">{a.currency}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Son 50 işlem</p>
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Açıklama</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {(transactions.data ?? []).map((t) => {
                const tx = Array.isArray(t.transactions) ? t.transactions[0] : t.transactions;
                return (
                  <tr key={t.id}>
                    <td className="px-3 py-2 text-text-secondary">
                      {tx ? new Date(tx.occurred_at).toLocaleDateString("tr-TR") : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-text-primary">
                      {(t.amount_cents / 100).toFixed(2)} {t.currency}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{t.note || "—"}</td>
                    <td className="px-3 py-2">
                      {tx?.status === "cancelled" ? (
                        <span className="text-xs text-text-muted">İptal</span>
                      ) : (
                        <span className="text-xs text-accent">Aktif</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {tx && tx.status === "active" ? (
                        <AdminCancelTransactionButton transactionId={tx.id} spaceId={space.id} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Borç/Alacak</p>
        <div className="flex flex-col gap-2">
          {(debts.data ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
              <span className="text-sm font-medium text-text-primary">{d.counterparty_name}</span>
              <span className="text-xs text-text-muted">
                {(d.principal_cents / 100).toFixed(2)} TL · {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
