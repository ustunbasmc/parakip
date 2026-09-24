"use client";

import { useRef, useState, useTransition } from "react";
import { countBroadcastAudience, sendBroadcast, type Audience } from "@/app/admin/notifications/actions";

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "Tüm kullanıcılar" },
  { value: "premium", label: "Premium kullanıcılar" },
  { value: "free", label: "Ücretsiz kullanıcılar" },
  { value: "user", label: "Tek kullanıcı (e-posta)" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";

/**
 * İki adımlı gönderim: önce alıcı sayısı gösterilir, sonra onaylanır —
 * yanlışlıkla herkese bildirim gitmesin diye.
 */
export function BroadcastForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<Audience>("all");
  const [count, setCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const invalidate = () => {
    setCount(null);
    setResult(null);
  };

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          if (count === null) {
            const r = await countBroadcastAudience(fd);
            if (!r.ok) setResult({ ok: false, message: r.message ?? "Alıcılar bulunamadı." });
            else setCount(r.count);
            return;
          }
          const r = await sendBroadcast(fd);
          setResult(r);
          if (r.ok) {
            formRef.current?.reset();
            setAudience("all");
            setCount(null);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
        Kime
        <select
          name="audience"
          value={audience}
          onChange={(e) => {
            setAudience(e.target.value as Audience);
            invalidate();
          }}
          className={inputClass}
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      {audience === "user" ? (
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          E-posta
          <input name="email" type="email" required onChange={invalidate} className={inputClass} placeholder="ornek@eposta.com" />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
        Başlık
        <input name="title" required maxLength={120} onChange={invalidate} className={inputClass} placeholder="Yeni özellik: Net değer ekranı" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
        Mesaj (isteğe bağlı)
        <textarea name="body" maxLength={1000} rows={3} onChange={invalidate} className={inputClass} placeholder="Kısa ve net bir açıklama…" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
        Tıklayınca açılacak sayfa (isteğe bağlı)
        <input name="link" onChange={invalidate} className={inputClass} placeholder="/net-worth" />
        <span className="font-normal text-text-muted">Yalnızca uygulama içi yol (/ ile başlar). Boş bırakılırsa bildirimler sayfası açılır.</span>
      </label>

      <p className="text-xs text-text-muted">
        Bildirim uygulama içinde görünür; anlık bildirimi açık cihazlara ayrıca telefon/bilgisayar bildirimi olarak gider. E-posta
        gönderilmez.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`h-9 rounded-lg px-4 text-sm font-bold disabled:opacity-60 ${
            count === null ? "border border-border text-text-primary" : "bg-accent text-text-on-accent"
          }`}
        >
          {pending ? "Bekle…" : count === null ? "Alıcıları hesapla" : `${count} kişiye gönder`}
        </button>
        {count !== null && !pending ? (
          <button type="button" onClick={invalidate} className="text-xs font-semibold text-text-muted">
            Vazgeç
          </button>
        ) : null}
      </div>
      {result ? (
        <p role="status" className={`text-xs font-semibold ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
