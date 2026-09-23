import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import {
  fmtDate,
  fmtDateTime,
  isSubscriptionActive,
  resolveUserLabels,
  ROLE_LABELS,
  SUB_STATUS_LABELS,
  subscriptionSource,
} from "@/lib/admin/data";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminCancelTransactionButton } from "@/components/admin/AdminCancelTransactionButton";
import { SubscriptionManager } from "@/components/admin/SubscriptionManager";
import { Badge, Card, CardHeader, KeyValue, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/admin/ui";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_TYPE: Record<string, string> = { income: "Gelir", expense: "Gider", transfer: "Transfer" };
const DEBT_STATUS: Record<string, string> = { open: "Açık", partial: "Kısmi ödendi", paid: "Ödendi", cancelled: "İptal" };

export default async function AdminSpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = getAdminDbClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("id, name, type, sector, is_archived, owner_user_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!space) notFound();

  const [{ data: book }, { data: members }, { data: sub }] = await Promise.all([
    supabase.from("books").select("id").eq("space_id", id).maybeSingle(),
    supabase.from("space_members").select("user_id, role, created_at").eq("space_id", id),
    space.type === "business"
      ? supabase.from("subscriptions").select("status, current_period_end, metadata").eq("plan", "business").eq("space_id", id).maybeSingle()
      : supabase
          .from("subscriptions")
          .select("status, current_period_end, metadata")
          .eq("plan", "home_premium")
          .eq("owner_user_id", space.owner_user_id)
          .maybeSingle(),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const nameOf = await resolveUserLabels([...memberIds, space.owner_user_id]);

  const bookId = book?.id;
  const [accounts, entries, entryCount, debts] = await Promise.all([
    bookId
      ? supabase.from("account_balances").select("account_id, name, type, currency, is_archived, balance_cents").eq("book_id", bookId).order("name")
      : Promise.resolve({ data: [] as { account_id: string; name: string; type: string; currency: string; is_archived: boolean; balance_cents: number }[] }),
    bookId
      ? supabase
          .from("transaction_entries")
          .select("id, account_id, amount_cents, currency, note, transactions!inner(id, type, status, occurred_at)")
          .eq("book_id", bookId)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    bookId
      ? supabase.from("transaction_entries").select("id", { count: "exact", head: true }).eq("book_id", bookId)
      : Promise.resolve({ count: 0 }),
    bookId
      ? supabase.from("debts").select("id, counterparty_name, direction, principal_cents, status, due_date").eq("book_id", bookId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as { id: string; counterparty_name: string; direction: string; principal_cents: number; status: string; due_date: string | null }[] }),
  ]);

  const accountName = new Map((accounts.data ?? []).map((a) => [a.account_id, a.name]));
  const tryBalance = (accounts.data ?? []).filter((a) => a.currency === "TRY" && !a.is_archived).reduce((s, a) => s + a.balance_cents, 0);
  const subActive = sub ? isSubscriptionActive(sub) : false;
  const ownerName = nameOf.get(space.owner_user_id) ?? "Bilinmeyen kullanıcı";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<AdminBackLink href="/admin/spaces" label="Alanlar" />}
        title={space.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={space.type === "business" ? "accent" : "neutral"}>{space.type === "home" ? "Ev" : "İşletme"}</Badge>
            {space.is_archived ? <Badge>Arşivlenmiş</Badge> : null}
            {subActive ? <Badge tone="success">Premium</Badge> : <Badge>Ücretsiz</Badge>}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hesap" value={(accounts.data ?? []).filter((a) => !a.is_archived).length} hint={`${(accounts.data ?? []).length} toplam`} />
        <StatCard label="TRY bakiye" value={formatCentsAsCurrency(tryBalance, "TRY")} hint="aktif hesaplar" />
        <StatCard label="İşlem kaydı" value={(entryCount.count ?? 0).toLocaleString("tr-TR")} hint="hareket satırı" />
        <StatCard label="Üye" value={(members ?? []).length} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Bilgiler" />
            <KeyValue
              items={[
                { label: "Sahip", value: <Link href={`/admin/users/${space.owner_user_id}`} className="font-semibold text-accent">{ownerName}</Link> },
                { label: "Oluşturma", value: fmtDateTime(space.created_at) },
                { label: "Sektör", value: space.sector || "—" },
                { label: "Alan kimliği", value: <span className="font-mono text-xs">{space.id}</span> },
              ]}
            />
          </Card>

          <Card padded={false}>
            <div className="p-4 pb-0 sm:p-5 sm:pb-0">
              <CardHeader title="Son 50 hareket" subtitle="İptal, finansal kaydı silmez; işlemi 'iptal' durumuna alır ve bakiyeden düşer." />
            </div>
            {(entries.data ?? []).length === 0 ? (
              <p className="px-5 pb-5 text-sm text-text-muted">Hareket yok.</p>
            ) : (
              <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Tarih</Th>
                      <Th>Tür</Th>
                      <Th>Hesap</Th>
                      <Th>Tutar</Th>
                      <Th>Açıklama</Th>
                      <Th>Durum</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(entries.data ?? []).map((t) => {
                      const tx = Array.isArray(t.transactions) ? t.transactions[0] : t.transactions;
                      return (
                        <tr key={t.id}>
                          <Td className="whitespace-nowrap text-xs text-text-secondary">{tx ? fmtDate(tx.occurred_at) : "—"}</Td>
                          <Td className="text-xs">{tx ? TX_TYPE[tx.type] ?? tx.type : "—"}</Td>
                          <Td className="max-w-[10rem] truncate text-xs text-text-secondary">{accountName.get(t.account_id) ?? "—"}</Td>
                          <Td className={`whitespace-nowrap font-semibold tabular-nums ${t.amount_cents >= 0 ? "text-income" : "text-expense"}`}>
                            {formatCentsAsCurrency(t.amount_cents, t.currency)}
                          </Td>
                          <Td className="max-w-[14rem] truncate text-xs text-text-secondary">{t.note || "—"}</Td>
                          <Td>{tx?.status === "cancelled" ? <Badge>İptal</Badge> : <Badge tone="accent">Aktif</Badge>}</Td>
                          <Td>{tx && tx.status === "active" ? <AdminCancelTransactionButton transactionId={tx.id} spaceId={space.id} /> : null}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Borç / alacak" subtitle="Son 30 kayıt" />
            {(debts.data ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">Kayıt yok.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {(debts.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text-primary">{d.counterparty_name}</span>
                      <span className="block text-xs text-text-muted">
                        {d.direction === "receivable" ? "Alacak" : "Borç"}
                        {d.due_date ? ` · vade ${fmtDate(d.due_date)}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-text-secondary">{formatCentsAsCurrency(d.principal_cents, "TRY")}</span>
                      <Badge>{DEBT_STATUS[d.status] ?? d.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title={space.type === "business" ? "İşletme Premium" : "Ev Premium (sahip)"}
              subtitle={
                sub
                  ? `${SUB_STATUS_LABELS[sub.status] ?? sub.status} · ${subscriptionSource(sub.metadata)}${
                      sub.current_period_end ? ` · bitiş ${fmtDate(sub.current_period_end)}` : ""
                    }`
                  : "Abonelik kaydı yok"
              }
            />
            {space.type === "business" ? (
              <SubscriptionManager plan="business" targetId={space.id} active={subActive} compact />
            ) : (
              <p className="text-xs text-text-muted">
                Ev Premium sahip bazlıdır;{" "}
                <Link href={`/admin/users/${space.owner_user_id}`} className="font-semibold text-accent">
                  sahibin sayfasından
                </Link>{" "}
                yönetilir.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Üyeler" />
            <ul className="flex flex-col gap-2">
              {(members ?? []).map((m) => (
                <li key={m.user_id}>
                  <Link href={`/admin/users/${m.user_id}`} className="flex items-center justify-between gap-2 text-sm hover:opacity-80">
                    <span className="truncate font-medium text-text-primary">{nameOf.get(m.user_id) ?? "Bilinmeyen kullanıcı"}</span>
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{ROLE_LABELS[m.role] ?? m.role}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Hesaplar" />
            {(accounts.data ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">Hesap yok.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(accounts.data ?? []).map((a) => (
                  <li key={a.account_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-text-primary">
                      {a.name}
                      {a.is_archived ? <span className="text-xs text-text-muted"> (arşiv)</span> : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-text-secondary">{formatCentsAsCurrency(a.balance_cents, a.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
