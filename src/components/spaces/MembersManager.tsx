"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createSpaceInvitation,
  friendlyMemberError,
  leaveSpace,
  removeSpaceMember,
  revokeSpaceInvitation,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  updateSpaceMemberRole,
  type InvitableRole,
  type MemberQuota,
  type MemberRole,
  type SpaceMember,
} from "@/lib/api/members-rpc";
import { sendSpaceInvitationEmail } from "@/app/settings/spaces/actions";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CheckIcon, CopyIcon } from "@/components/icons";

export interface PendingInvitation {
  id: string;
  email: string;
  role: InvitableRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

function CopyLinkButton({ token, spaceName }: { token: string; spaceName: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = inviteUrl(token);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
        await nav.share({ title: "Parakip daveti", text: `"${spaceName}" alanına davet`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Paylaşım iptal edildi veya pano izni yok — sessizce geç.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-surface-muted"
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? "Kopyalandı" : "Bağlantıyı paylaş"}
    </button>
  );
}

export function MembersManager({
  spaceId,
  spaceName,
  isArchived,
  myRole,
  myUserId,
  members,
  invitations,
  quota,
}: {
  spaceId: string;
  spaceName: string;
  isArchived: boolean;
  myRole: MemberRole;
  myUserId: string;
  members: SpaceMember[];
  invitations: PendingInvitation[];
  quota: MemberQuota | null;
}) {
  const router = useRouter();
  const canManage = myRole === "owner" || myRole === "admin";
  const inviteRoles: InvitableRole[] = myRole === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("editor");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; email: string; emailed: boolean } | null>(null);

  async function run(key: string, fn: () => PromiseLike<{ error: { message?: string } | null }>) {
    setBusy(key);
    setError(null);
    try {
      const { error: rpcError } = await fn();
      if (rpcError) {
        setError(friendlyMemberError(rpcError));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("İşlem gerçekleştirilemedi. Lütfen tekrar dene.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setBusy("invite");
    setError(null);
    setCreated(null);
    try {
      const { data, error: rpcError } = await createSpaceInvitation(createClient(), spaceId, value, role);
      if (rpcError || !data) {
        setError(friendlyMemberError(rpcError));
        return;
      }
      const { sent } = await sendSpaceInvitationEmail(data.invitation_id).catch(() => ({ sent: false }));
      setCreated({ token: data.token, email: value, emailed: sent });
      setEmail("");
      router.refresh();
    } catch {
      setError("Davet oluşturulamadı. Lütfen tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  function canEdit(m: SpaceMember) {
    if (m.role === "owner" || m.userId === myUserId) return false;
    if (myRole === "owner") return true;
    return myRole === "admin" && (m.role === "editor" || m.role === "viewer");
  }

  const card = "rounded-2xl border border-border bg-surface p-4";
  // Ücretsiz plan: sahip dışı üye + bekleyen davet sınırı (veritabanında da uygulanır, bkz. 0066).
  const atLimit = quota !== null && quota.limit !== null && quota.used >= quota.limit;
  const quotaNote =
    quota && quota.limit !== null ? (
      <p className="text-xs text-text-muted">
        Ücretsiz plan: alan sahibi dışında {quota.used}/{quota.limit} üye (bekleyen davetler dahil). Premium&apos;da sınırsız.
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-4 pt-3 pb-6">
      {error ? <ErrorBanner message={error} /> : null}

      {canManage && !isArchived && atLimit ? (
        <div className={`${card} flex flex-col gap-2`}>
          <p className="text-sm font-bold text-text-primary">Üye sınırına ulaştın</p>
          <p className="text-xs text-text-secondary">
            Ücretsiz planda alan sahibi dışında {quota?.limit} kişi eklenebilir (bekleyen davetler dahil). Daha fazla kişiyle
            birlikte kullanmak için Premium&apos;a geç ya da bekleyen bir daveti geri çek.
          </p>
          <Link href={`/settings/plan?space=${spaceId}`} className="w-fit rounded-full bg-accent px-4 py-2 text-sm font-bold text-text-on-accent">
            Premium&apos;u incele
          </Link>
        </div>
      ) : null}

      {canManage && !isArchived && !atLimit ? (
        <form onSubmit={handleInvite} className={`${card} flex flex-col gap-3`}>
          <div>
            <p className="text-sm font-bold text-text-primary">Üye davet et</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Davet ettiğin kişi aynı e-posta adresiyle Parakip&apos;e giriş yapıp daveti kabul edince bu alanı görmeye başlar.
            </p>
            {quotaNote ? <div className="mt-1">{quotaNote}</div> : null}
          </div>
          <TextField
            label="E-posta"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-text-secondary">Rol</legend>
            {inviteRoles.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${
                  role === r ? "border-accent bg-accent-soft" : "border-border"
                }`}
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-0.5 accent-accent" />
                <span>
                  <span className="block font-semibold text-text-primary">{ROLE_LABELS[r]}</span>
                  <span className="block text-xs text-text-muted">{ROLE_DESCRIPTIONS[r]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" loading={busy === "invite"} fullWidth={false}>
            Davet oluştur
          </Button>
          {created ? (
            <div role="status" className="flex flex-col gap-2 rounded-xl bg-success-soft p-3 text-xs text-success">
              <p className="font-semibold">
                {created.emailed
                  ? `${created.email} adresine davet e-postası gönderildi.`
                  : `Davet oluşturuldu. ${created.email} kişisine bağlantıyı sen ilet (WhatsApp, e-posta vb.).`}
              </p>
              <div>
                <CopyLinkButton token={created.token} spaceName={spaceName} />
              </div>
              {!created.emailed ? (
                <p className="text-text-muted">Bu kişinin Parakip hesabı zaten varsa, uygulamadaki bildirimlerinde de davet görünür.</p>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      <section className={card}>
        <p className="mb-3 text-sm font-bold text-text-primary">Üyeler ({members.length})</p>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {m.displayName}
                  {m.userId === myUserId ? <span className="font-normal text-text-muted"> (sen)</span> : null}
                </p>
                <p className="truncate text-xs text-text-muted">{m.email}</p>
              </div>
              {canEdit(m) ? (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    aria-label={`${m.displayName} rolü`}
                    value={m.role}
                    disabled={busy !== null}
                    onChange={(e) =>
                      run(`role-${m.userId}`, () => updateSpaceMemberRole(createClient(), spaceId, m.userId, e.target.value as InvitableRole))
                    }
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary"
                  >
                    {(myRole === "owner" ? (["admin", "editor", "viewer"] as InvitableRole[]) : (["editor", "viewer"] as InvitableRole[])).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm(`${m.displayName} alandan çıkarılsın mı? Bu kişi alanın kayıtlarını artık göremez.`)) {
                        void run(`remove-${m.userId}`, () => removeSpaceMember(createClient(), spaceId, m.userId));
                      }
                    }}
                    className="h-9 rounded-lg px-2 text-xs font-semibold text-danger hover:bg-danger-soft"
                  >
                    Çıkar
                  </button>
                </div>
              ) : (
                <span className="w-fit shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  {ROLE_LABELS[m.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && invitations.length > 0 ? (
        <section className={card}>
          <p className="mb-3 text-sm font-bold text-text-primary">Bekleyen davetler</p>
          <ul className="flex flex-col divide-y divide-border">
            {invitations.map((inv) => {
              const expired = inv.expired;
              return (
                <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{inv.email}</p>
                    <p className="text-xs text-text-muted">
                      {ROLE_LABELS[inv.role]} · {expired ? "süresi doldu" : `${dateFmt.format(new Date(inv.expiresAt))} tarihine kadar geçerli`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!expired ? <CopyLinkButton token={inv.token} spaceName={spaceName} /> : null}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => run(`revoke-${inv.id}`, () => revokeSpaceInvitation(createClient(), inv.id))}
                      className="h-8 rounded-full px-3 text-xs font-semibold text-danger hover:bg-danger-soft"
                    >
                      Geri çek
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {myRole !== "owner" ? (
        <section className={`${card} flex flex-col gap-2`}>
          <p className="text-sm font-bold text-text-primary">Alandan ayrıl</p>
          <p className="text-xs text-text-muted">Ayrılırsan bu alanın kayıtlarını artık göremezsin. Yeniden katılmak için yeni bir davet gerekir.</p>
          <Button
            variant="secondary"
            fullWidth={false}
            loading={busy === "leave"}
            onClick={async () => {
              if (!window.confirm(`"${spaceName}" alanından ayrılmak istediğine emin misin?`)) return;
              const ok = await run("leave", () => leaveSpace(createClient(), spaceId));
              if (ok) router.push("/settings/spaces");
            }}
          >
            Alandan ayrıl
          </Button>
        </section>
      ) : (
        <p className="px-1 text-xs text-text-muted">
          Roller: <strong>Yönetici</strong> kayıtları yönetir ve üye davet eder; <strong>Düzenleyici</strong> kayıt ekler ve düzenler;{" "}
          <strong>İzleyici</strong> yalnızca görüntüler. Sahiplik devredilemez.
        </p>
      )}
    </div>
  );
}
