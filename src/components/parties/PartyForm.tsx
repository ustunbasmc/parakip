"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";

type PartyType = "customer" | "supplier";

interface Props {
  type: PartyType;
  spaceId: string;
  homeHref: string;
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Müşteri/Tedarikçi ekleme formu — accounts_insert_editor_plus ile AYNI
 * desen: doğrudan RLS'e tabi INSERT (customers_insert_editor_plus /
 * suppliers_insert_editor_plus, bkz. migration 0051), ayrı bir RPC
 * gerekmez.
 */
export function PartyForm({ type, spaceId, homeHref, variant = "page", onSuccess, onDirtyChange }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = name !== "" || phone !== "" || email !== "" || note !== "";
  useUnsavedChangesGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const table = type === "customer" ? "customers" : "suppliers";
  const title = type === "customer" ? "Yeni müşteri" : "Yeni tedarikçi";
  const nameLabel = type === "customer" ? "Ad soyad veya şirket adı" : "Firma/kişi adı";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submittingRef.current) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(`${nameLabel} boş olamaz.`);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from(table).insert({
      space_id: spaceId,
      name: trimmedName,
      phone: phone.trim() || null,
      email: email.trim() || null,
      note: note.trim() || null,
    });

    submittingRef.current = false;
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message.includes("row-level security") ? "Bu işlem için yetkin yok." : "Kaydedilemedi. Lütfen tekrar dene.");
      return;
    }

    if (variant === "modal") onSuccess?.();
    else router.push(homeHref);
  }

  const formBody = (
    <>
      <form id="party-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <TextField label={nameLabel} required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Telefon (isteğe bağlı)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField label="E-posta (isteğe bağlı)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>

      <div className={variant === "modal" ? "sticky bottom-0 border-t border-border bg-bg pt-3" : "sticky bottom-0 border-t border-border bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"}>
        <Button type="submit" form="party-form" loading={submitting}>
          Kaydet
        </Button>
      </div>
    </>
  );

  if (variant === "modal") return formBody;

  return (
    <AppShell
      variant="subpage"
      title={title}
      backFallbackHref={homeHref}
      backGuard={() => confirmLeaveIfDirty(isDirty)}
    >
      {formBody}
    </AppShell>
  );
}
