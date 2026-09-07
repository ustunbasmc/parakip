"use client";

import { useState } from "react";
import { updateUserProfile } from "@/app/admin/users/[id]/actions";

export function AdminUserEditForm({
  userId,
  firstName,
  lastName,
  phone,
}: {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(userId, formData);
      setMessage({ type: "success", text: "Profil güncellendi." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Güncellenemedi." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text-primary">Profili düzenle</p>
      {message ? (
        <p className={`text-xs ${message.type === "success" ? "text-success" : "text-danger"}`}>{message.text}</p>
      ) : null}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-text-secondary">Ad</label>
          <input
            name="firstName"
            defaultValue={firstName ?? ""}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-text-secondary">Soyad</label>
          <input
            name="lastName"
            defaultValue={lastName ?? ""}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary">Telefon</label>
        <input
          name="phone"
          defaultValue={phone ?? ""}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-1 w-fit rounded-full bg-accent px-4 py-2 text-sm font-bold text-text-on-accent disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
