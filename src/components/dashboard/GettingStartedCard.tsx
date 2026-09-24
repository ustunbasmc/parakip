"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CheckIcon } from "@/components/icons";

export interface GettingStartedStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
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

/**
 * Yeni kullanıcı için başlangıç listesi. Adımlar gerçek verilerden işaretlenir
 * (sunucuda sayılır); hepsi tamamlanınca kart hiç gösterilmez. Kullanıcı
 * "Gizle" derse bu cihazda bu alan için saklanır (yalnızca bir tercih).
 */
export function GettingStartedCard({ spaceId, steps }: { spaceId: string; steps: GettingStartedStep[] }) {
  const hidden = useSyncExternalStore(subscribe, () => isHidden(spaceId), () => false);
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((doneCount / steps.length) * 100);

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
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted ${s.key === next?.key ? "bg-accent-soft/50" : ""}`}
            >
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
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
