"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { InstallInstructionsModal } from "@/components/InstallInstructionsModal";
import { promptInstall, useInstallState } from "@/lib/pwa/install";

export interface GettingStartedStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
  /** "install": ana ekrana ekleme — cihaza özel, tarayıcıda algılanır. */
  kind?: "install";
}

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const storageKey = (spaceId: string) => `parakip.gettingStarted.hidden.${spaceId}`;

function isHidden(spaceId: string): boolean {
  try {
    return localStorage.getItem(storageKey(spaceId)) === "1";
  } catch {
    return false;
  }
}

const rowClass = "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-muted";

/**
 * Yeni kullanıcı için başlangıç listesi. Adımlar gerçek verilerden işaretlenir
 * (sunucuda sayılır); hepsi tamamlanınca kart hiç gösterilmez. Kullanıcı
 * "Gizle" derse bu cihazda bu alan için saklanır (yalnızca bir tercih).
 *
 * "Ana ekrana ekle" adımı cihaza özeldir: bu cihazda uygulama ana ekrandan
 * açıldıysa ya da kullanıcının kayıtlı bildirim cihazı varsa tamamlanmış
 * sayılır. Kurulum yapılamayan masaüstü tarayıcılarda adım gösterilmez.
 */
export function GettingStartedCard({ spaceId, steps: serverSteps }: { spaceId: string; steps: GettingStartedStep[] }) {
  const hidden = useSyncExternalStore(subscribe, () => isHidden(spaceId), () => false);
  const install = useInstallState();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const steps = serverSteps.flatMap((s) => {
    if (s.kind !== "install") return [s];
    const done = s.done || install.installed;
    if (!done && install.platform === "other" && !install.canPrompt) return [];
    return [{ ...s, done }];
  });

  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((doneCount / steps.length) * 100);

  const content = (s: GettingStartedStep): ReactNode => (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          s.done ? "border-accent bg-accent text-text-on-accent" : "border-border-strong text-transparent"
        }`}
        aria-hidden="true"
      >
        <CheckIcon size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${s.done ? "text-text-muted line-through" : "text-text-primary"}`}>{s.label}</span>
        {!s.done ? <span className="block truncate text-xs text-text-muted">{s.hint}</span> : null}
      </span>
      {!s.done ? <span className="shrink-0 text-accent">→</span> : null}
      <span className="sr-only">{s.done ? "tamamlandı" : "yapılacak"}</span>
    </>
  );

  return (
    <section className="surface-card animate-rise min-w-0 rounded-3xl p-4 sm:p-5" aria-label="Başlangıç listesi">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-text-primary">Parakip&apos;i kurmayı tamamla</h2>
          <p className="text-xs text-text-muted">
            {doneCount}/{steps.length} adım tamamlandı
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey(spaceId), "1");
            } catch {
              // tercih kaydedilemezse kart görünmeye devam eder
            }
            listeners.forEach((cb) => cb());
          }}
          className="shrink-0 text-xs font-semibold text-text-muted hover:text-text-primary"
        >
          Gizle
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 flex flex-col gap-1">
        {steps.map((s) => {
          const highlight = s.key === next?.key ? "bg-accent-soft/50" : "";
          return (
            <li key={s.key}>
              {s.kind === "install" && !s.done ? (
                <button
                  type="button"
                  className={`${rowClass} ${highlight}`}
                  onClick={async () => {
                    if (install.canPrompt) await promptInstall();
                    else setShowInstallHelp(true);
                  }}
                >
                  {content(s)}
                </button>
              ) : s.kind === "install" ? (
                <div className={rowClass}>{content(s)}</div>
              ) : (
                <Link href={s.href} className={`${rowClass} ${highlight}`}>
                  {content(s)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <InstallInstructionsModal open={showInstallHelp} platform={install.platform} onClose={() => setShowInstallHelp(false)} />
    </section>
  );
}
