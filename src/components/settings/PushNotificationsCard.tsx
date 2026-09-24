"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { sendTestPushAction } from "@/app/settings/notifications/actions";

type Status = "loading" | "unconfigured" | "unsupported" | "ios-install" | "dev" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  // Üretimde ConnectivityLayer zaten kaydeder; kayıt henüz bitmediyse burada kaydet.
  if (process.env.NODE_ENV !== "production") return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function detect(): Promise<{ status: Status; hideDetails: boolean }> {
  if (!VAPID_PUBLIC_KEY) return { status: "unconfigured", hideDetails: false };
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return { status: "unsupported", hideDetails: false };
  if (isIosBrowserTab()) return { status: "ios-install", hideDetails: false };
  if (!("PushManager" in window) || !("Notification" in window)) return { status: "unsupported", hideDetails: false };
  if (Notification.permission === "denied") return { status: "denied", hideDetails: false };
  const reg = await getRegistration();
  if (!reg) return { status: "dev", hideDetails: false };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { status: "off", hideDetails: false };
  const { data } = await createClient().from("push_subscriptions").select("hide_details").eq("endpoint", sub.endpoint).maybeSingle();
  // Tarayıcıda abonelik var ama sunucuda yoksa (ör. başka hesaptan çıkış) kapalı say.
  return data ? { status: "on", hideDetails: data.hide_details } : { status: "off", hideDetails: false };
}

async function saveSubscription(sub: PushSubscription, hideDetails: boolean) {
  const json = sub.toJSON();
  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
    p_hide_details: hideDetails,
  });
  if (error) throw error;
}

/**
 * Bu cihaz için anlık bildirim aç/kapat. Abonelik cihaza özeldir: telefonda
 * ve bilgisayarda ayrı ayrı açılır. Hangi bildirim türlerinin geleceği
 * alttaki tercihlerden belirlenir (kapalı türler hiç oluşturulmaz).
 */
export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [hideDetails, setHideDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, startTest] = useTransition();

  useEffect(() => {
    let cancelled = false;
    detect()
      .catch(() => ({ status: "unsupported" as Status, hideDetails: false }))
      .then((r) => {
        if (cancelled) return;
        setStatus(r.status);
        setHideDetails(r.hideDetails);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        setStatus("dev");
        return;
      }
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
      await saveSubscription(sub, hideDetails);
      setStatus("on");
      setMessage({ ok: true, text: "Anlık bildirimler bu cihazda açıldı." });
    } catch {
      setMessage({ ok: false, text: "Bildirimler açılamadı. Lütfen tekrar dene." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await createClient().rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setMessage({ ok: false, text: "İşlem tamamlanamadı. Lütfen tekrar dene." });
    } finally {
      setBusy(false);
    }
  }

  async function toggleHide(next: boolean) {
    setHideDetails(next);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await saveSubscription(sub, next);
    } catch {
      setHideDetails(!next);
      setMessage({ ok: false, text: "Tercih kaydedilemedi." });
    }
  }

  const hint: Partial<Record<Status, string>> = {
    loading: "Kontrol ediliyor…",
    unconfigured: "Anlık bildirimler henüz etkin değil.",
    unsupported: "Bu tarayıcı anlık bildirimleri desteklemiyor.",
    "ios-install": "iPhone ve iPad'de anlık bildirim için önce Safari'de Paylaş → \"Ana Ekrana Ekle\" ile Parakip'i ekle, sonra uygulamayı ana ekrandan açıp buradan etkinleştir.",
    dev: "Anlık bildirimler yalnızca yayındaki sürümde çalışır.",
    denied: "Bildirim izni bu tarayıcıda engellenmiş. Tarayıcı veya telefon ayarlarından Parakip için bildirimlere izin verip sayfayı yenile.",
    off: "Borç vadesi, bütçe uyarısı ve aylık özet uygulama kapalıyken de bu cihaza gelsin.",
    on: "Bu cihaz anlık bildirim alıyor.",
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Anlık bildirimler">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">Anlık bildirimler (bu cihaz)</h2>
          <p className="mt-1 text-xs text-text-muted">{hint[status]}</p>
        </div>
        {status === "off" ? (
          <Button onClick={enable} loading={busy} fullWidth={false} className="shrink-0">
            Aç
          </Button>
        ) : status === "on" ? (
          <Button variant="secondary" onClick={disable} loading={busy} fullWidth={false} className="shrink-0">
            Kapat
          </Button>
        ) : null}
      </div>

      {status === "on" ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              checked={hideDetails}
              onChange={(e) => toggleHide(e.target.checked)}
            />
            <span>
              Kilit ekranında ayrıntıları gizle
              <span className="block text-xs text-text-muted">Tutar ve açıklama yerine yalnızca &quot;Yeni bir bildirimin var&quot; görünür.</span>
            </span>
          </label>
          <button
            type="button"
            disabled={testing}
            onClick={() =>
              startTest(async () => {
                const r = await sendTestPushAction();
                setMessage({ ok: r.ok, text: r.message });
              })
            }
            className="self-start text-xs font-bold text-accent disabled:opacity-60"
          >
            {testing ? "Gönderiliyor…" : "Deneme bildirimi gönder"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p role="status" className={`mt-3 text-xs ${message.ok ? "text-income" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
