import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alan üyeliği ve davet RPC sarmalayıcıları (bkz. migration 0065).
 * space_members tablosuna doğrudan yazma izni YOKTUR; tüm değişiklikler
 * bu SECURITY DEFINER fonksiyonlarla, rol kurallarıyla birlikte yapılır.
 */

export type MemberRole = "owner" | "admin" | "editor" | "viewer";
export type InvitableRole = Exclude<MemberRole, "owner">;

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  editor: "Düzenleyici",
  viewer: "İzleyici",
};

export const ROLE_DESCRIPTIONS: Record<InvitableRole, string> = {
  admin: "Kayıt ekler/düzenler, üye davet eder ve yönetir (yönetici atayamaz).",
  editor: "Gelir, gider, borç ve bütçe kaydı ekler ve düzenler; bazı iptal ve arşivleme işlemleri yalnızca yöneticiye açıktır.",
  viewer: "Yalnızca görüntüler; kayıt ekleyemez.",
};

export interface SpaceMember {
  userId: string;
  role: MemberRole;
  displayName: string;
  email: string;
  joinedAt: string;
}

export interface InvitationPreview {
  invitationId: string;
  spaceName: string;
  spaceType: "home" | "business";
  role: InvitableRole;
  inviterName: string;
  emailHint: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  expired: boolean;
  emailMatches: boolean;
  alreadyMember: boolean;
}

export interface MyInvitation {
  invitationId: string;
  token: string;
  spaceName: string;
  spaceType: "home" | "business";
  role: InvitableRole;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
}

export async function getSpaceMembers(supabase: SupabaseClient, spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.rpc("get_space_members", { p_space_id: spaceId });
  if (error) throw error;
  return (data ?? []).map((r: { user_id: string; role: MemberRole; display_name: string; email: string; joined_at: string }) => ({
    userId: r.user_id,
    role: r.role,
    displayName: r.display_name,
    email: r.email,
    joinedAt: r.joined_at,
  }));
}

export function createSpaceInvitation(supabase: SupabaseClient, spaceId: string, email: string, role: InvitableRole) {
  return supabase.rpc("create_space_invitation", { p_space_id: spaceId, p_email: email, p_role: role }).single<{ invitation_id: string; token: string }>();
}

export function revokeSpaceInvitation(supabase: SupabaseClient, invitationId: string) {
  return supabase.rpc("revoke_space_invitation", { p_invitation_id: invitationId });
}

export async function getInvitationPreview(supabase: SupabaseClient, token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });
  if (error) throw error;
  const r = (data ?? [])[0];
  if (!r) return null;
  return {
    invitationId: r.invitation_id,
    spaceName: r.space_name,
    spaceType: r.space_type,
    role: r.role,
    inviterName: r.inviter_name,
    emailHint: r.email_hint,
    status: r.status,
    expired: r.expired,
    emailMatches: r.email_matches,
    alreadyMember: r.already_member,
  };
}

export function respondToInvitation(supabase: SupabaseClient, token: string, accept: boolean) {
  return supabase.rpc("respond_to_invitation", { p_token: token, p_accept: accept });
}

export async function getMyPendingInvitations(supabase: SupabaseClient): Promise<MyInvitation[]> {
  const { data, error } = await supabase.rpc("get_my_pending_invitations");
  if (error) throw error;
  return (data ?? []).map(
    (r: {
      invitation_id: string;
      token: string;
      space_name: string;
      space_type: "home" | "business";
      role: InvitableRole;
      inviter_name: string;
      created_at: string;
      expires_at: string;
    }) => ({
      invitationId: r.invitation_id,
      token: r.token,
      spaceName: r.space_name,
      spaceType: r.space_type,
      role: r.role,
      inviterName: r.inviter_name,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })
  );
}

export function updateSpaceMemberRole(supabase: SupabaseClient, spaceId: string, userId: string, role: InvitableRole) {
  return supabase.rpc("update_space_member_role", { p_space_id: spaceId, p_user_id: userId, p_role: role });
}

export function removeSpaceMember(supabase: SupabaseClient, spaceId: string, userId: string) {
  return supabase.rpc("remove_space_member", { p_space_id: spaceId, p_user_id: userId });
}

export function leaveSpace(supabase: SupabaseClient, spaceId: string) {
  return supabase.rpc("leave_space", { p_space_id: spaceId });
}

/** RPC hata mesajları zaten Türkçe (bkz. 0065); ağ/izin hataları için genel metin. */
export function friendlyMemberError(error: { message?: string; code?: string } | null | undefined): string {
  const m = error?.message ?? "";
  if (/[çğıöşüÇĞİÖŞÜ]/.test(m) || /^(Bu |Geçerli|Geçersiz|Alan|Oturum|Üye|Yönetici|Kendini)/.test(m)) return m;
  return "İşlem gerçekleştirilemedi. Lütfen tekrar dene.";
}
