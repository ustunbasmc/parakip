"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { FormSelect } from "@/components/forms/FormSelect";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CheckCircleIcon, XIcon } from "@/components/icons";
import { createSupportTicket } from "@/app/support/actions";
import { useUnsavedChangesGuard, confirmLeaveIfDirty } from "@/lib/forms/useUnsavedChangesGuard";
import {
  ATTACHMENT_TYPES,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  SCREEN_OPTIONS,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_BUCKET,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  validateAttachment,
  type TicketType,
} from "@/lib/support/constants";

interface Props {
  userId: string;
  initialType: TicketType | "";
  initialSubject: string;
  initialScreen: string;
  initialSpaceType: "home" | "business" | null;
  relatedArticle: { slug: string; title: string } | null;
  activeSpaceType?: "home" | "business";
}

/**
 * Destek talebi formu. Taslak veriler localStorage'a YAZILMAZ (destek
 * içeriği hassas olabilir) — yalnızca bileşen state'inde tutulur.
 *
 * ÇİFT GÖNDERİM KORUMASI: (1) gönderim sırasında buton devre dışı ve
 * submittingRef ile ikinci çağrı engellenir, (2) form açılışında üretilen
 * clientRequestId sunucuda UNIQUE kısıtla korunur — ağ yeniden denemesi
 * bile ikinci bir talep oluşturamaz.
 */
export function SupportTicketForm({
  userId,
  initialType,
  initialSubject,
  initialScreen,
  initialSpaceType,
  relatedArticle,
  activeSpaceType,
}: Props) {
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<TicketType | "">(initialType);
  const [subject, setSubject] = useState(initialSubject);
  const [description, setDescription] = useState("");
  const [screen, setScreen] = useState(initialScreen);
  const [spaceType, setSpaceType] = useState<"home" | "business" | "">(initialSpaceType ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkArticle, setLinkArticle] = useState(Boolean(relatedArticle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ ticketId: string; attachmentFailed: boolean } | null>(null);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = !done && (description.trim().length > 0 || subject.trim() !== initialSubject.trim() || file !== null);
  useUnsavedChangesGuard(isDirty);

  function validate() {
    const next: Record<string, string> = {};
    if (!type) next.type = "Lütfen bir talep türü seç.";
    const s = subject.trim();
    if (s.length < SUBJECT_MIN) next.subject = `Konu en az ${SUBJECT_MIN} karakter olmalı.`;
    if (s.length > SUBJECT_MAX) next.subject = `Konu en fazla ${SUBJECT_MAX} karakter olabilir.`;
    const d = description.trim();
    if (d.length < DESCRIPTION_MIN) next.description = `Lütfen sorunu biraz daha açıkla (en az ${DESCRIPTION_MIN} karakter).`;
    if (d.length > DESCRIPTION_MAX) next.description = `Açıklama en fazla ${DESCRIPTION_MAX} karakter olabilir.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleFileChange(f: File | null) {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const err = validateAttachment(f);
    if (err) {
      setFileError(err);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitError(null);
    if (!validate()) return;

    submittingRef.current = true;
    setLoading(true);

    // Ekran görüntüsü ÖNCE kullanıcının kendi (private) klasörüne yüklenir.
    // Yükleme başarısız olursa talep YİNE DE gönderilir.
    let attachment: { path: string; mimeType: string; size: number } | null = null;
    let uploadFailed = false;
    if (file) {
      try {
        const ext = ATTACHMENT_TYPES[file.type];
        const path = `${userId}/${clientRequestId}/${crypto.randomUUID()}.${ext}`;
        const supabase = createClient();
        const { error } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error && !/exists|duplicate/i.test(error.message)) uploadFailed = true;
        else attachment = { path, mimeType: file.type, size: file.size };
      } catch {
        uploadFailed = true;
      }
    }

    const result = await createSupportTicket({
      clientRequestId,
      type: type as TicketType,
      subject,
      description,
      screen,
      spaceType: spaceType || null,
      relatedArticleSlug: linkArticle && relatedArticle ? relatedArticle.slug : null,
      attachment,
      clientContext: {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
      },
    }).catch(() => ({ ok: false as const, error: "Bağlantı hatası. Lütfen tekrar dene." }));

    setLoading(false);
    submittingRef.current = false;

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setDone({ ticketId: result.ticketId, attachmentFailed: uploadFailed || result.attachmentFailed });
  }

  if (done) {
    return (
      <AppShell variant="subpage" title="Destek talebi" backFallbackHref="/help" activeSpaceType={activeSpaceType}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <CheckCircleIcon size={40} className="text-success" />
          <p className="text-lg font-bold text-text-primary">Talebin alındı</p>
          <p className="max-w-sm text-sm text-text-muted">
            Ekibimiz talebini inceleyip en kısa sürede yanıt verecek. Yanıtı &ldquo;Destek Taleplerim&rdquo; ekranından
            takip edebilirsin.
          </p>
          {done.attachmentFailed ? (
            <p role="status" className="max-w-sm rounded-xl bg-warning-soft p-3 text-xs text-warning">
              Ekran görüntüsü yüklenemedi, ama talebin kaydedildi. Gerekirse talep detayından bize yazabilirsin.
            </p>
          ) : null}
          <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
            <Link
              href={`/support/tickets/${done.ticketId}`}
              className="flex h-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-text-on-accent"
            >
              Talebimi görüntüle
            </Link>
            <Link href="/help" className="flex h-12 items-center justify-center rounded-2xl bg-surface-muted text-sm font-semibold text-text-primary">
              Yardım Merkezi&apos;ne dön
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      variant="subpage"
      title="Destek talebi oluştur"
      backFallbackHref="/help"
      backGuard={() => confirmLeaveIfDirty(isDirty)}
      activeSpaceType={activeSpaceType}
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-5 pb-6 pt-3">
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-text-secondary">Talep türü</legend>
          <div className="grid grid-cols-2 gap-2">
            {TICKET_TYPES.map((t) => (
              <label
                key={t}
                className={`flex min-h-12 cursor-pointer items-center rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  type === t ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-primary"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {TICKET_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          {errors.type ? (
            <p role="alert" className="text-sm text-danger">
              {errors.type}
            </p>
          ) : null}
        </fieldset>

        <TextField
          label="Konu"
          name="subject"
          value={subject}
          maxLength={SUBJECT_MAX}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Kısaca ne oldu?"
          error={errors.subject}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-text-secondary">
            Açıklama
          </label>
          <textarea
            id="description"
            name="description"
            rows={6}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="description-hint"
            placeholder={
              type === "feature"
                ? "Nasıl bir özellik istersin, sana nasıl yardımcı olur?"
                : "Ne yapmaya çalışıyordun, ne oldu? Adım adım yazarsan daha hızlı çözeriz."
            }
            className={`w-full rounded-2xl border bg-surface px-4 py-3 text-[1.0625rem] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent ${
              errors.description ? "border-danger" : "border-border"
            }`}
          />
          {errors.description ? (
            <p role="alert" className="text-sm text-danger">
              {errors.description}
            </p>
          ) : null}
          <p id="description-hint" className="text-xs text-text-muted">
            Şifreni, kart bilgilerini veya banka giriş bilgilerini asla yazma — ekibimiz bunları hiçbir zaman istemez.
          </p>
        </div>

        <FormSelect
          id="screen"
          label="Sorunun yaşandığı ekran (isteğe bağlı)"
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          placeholder="Seç"
          options={SCREEN_OPTIONS}
        />

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-text-secondary">Hangi alanda? (isteğe bağlı)</legend>
          <div className="flex gap-1 rounded-full bg-surface-muted p-1">
            {[
              { value: "home", label: "Ev" },
              { value: "business", label: "İşletme" },
              { value: "", label: "Bilmiyorum" },
            ].map((o) => (
              <label
                key={o.label}
                className={`flex-1 cursor-pointer rounded-full py-2 text-center text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  spaceType === o.value ? "bg-accent text-text-on-accent" : "text-text-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="spaceType"
                  value={o.value}
                  checked={spaceType === o.value}
                  onChange={() => setSpaceType(o.value as "home" | "business" | "")}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Ekran görüntüsü (isteğe bağlı)</span>
          {file ? (
            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{file.name}</span>
              <span className="shrink-0 text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                aria-label="Ekran görüntüsünü kaldır"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
              >
                <XIcon size={16} />
              </button>
            </div>
          ) : (
            <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border-strong text-sm font-semibold text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
              Görsel seç (JPG, PNG, WebP · en fazla 5 MB)
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          )}
          {fileError ? (
            <p role="alert" className="text-sm text-danger">
              {fileError}
            </p>
          ) : (
            <p className="text-xs text-text-muted">Görsel gizli saklanır; yalnızca sen ve destek ekibi görebilir.</p>
          )}
        </div>

        {relatedArticle ? (
          <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
            <input
              type="checkbox"
              checked={linkArticle}
              onChange={(e) => setLinkArticle(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
            />
            <span className="min-w-0 text-sm text-text-secondary">
              İlgili makaleyi ekle: <strong className="text-text-primary">{relatedArticle.title}</strong>
            </span>
          </label>
        ) : null}

        {submitError ? <ErrorBanner message={submitError} /> : null}

        <Button type="submit" loading={loading}>
          {loading ? "Gönderiliyor..." : "Talebi gönder"}
        </Button>
      </form>
    </AppShell>
  );
}
