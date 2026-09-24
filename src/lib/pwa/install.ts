"use client";

import { useSyncExternalStore } from "react";

/**
 * "Ana ekrana ekle" durumu — tek kaynak. Kurulum cihaza özeldir ve sunucuda
 * tutulmaz; bu cihazda uygulama bir kez ana ekrandan (standalone) açıldıysa
 * ya da tarayıcı kurulumu bildirdiyse `parakip.installed` işaretlenir.
 *
 * Android/Chrome'un `beforeinstallprompt` olayı sayfa yüklenirken bir kez
 * gelir; bileşen daha takılmadan kaçmasın diye dinleyici modül yüklenince
 * kurulur.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALLED_KEY = "parakip.installed";
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

function isStandaloneNow(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // tercih kaydedilemezse bir sonraki açılışta tekrar algılanır
  }
}

if (typeof window !== "undefined") {
  if (isStandaloneNow()) markInstalled();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    markInstalled();
    notify();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export type InstallPlatform = "ios" | "android" | "other";

export interface InstallState {
  /** Şu an ana ekrandan açılmış mı. */
  standalone: boolean;
  /** Bu cihazda daha önce kurulduğu biliniyor mu (standalone dahil). */
  installed: boolean;
  /** Tarayıcının kendi kurulum penceresi kullanılabilir mi. */
  canPrompt: boolean;
  platform: InstallPlatform;
}

const SERVER_STATE: InstallState = { standalone: false, installed: false, canPrompt: false, platform: "other" };
let cached: InstallState = SERVER_STATE;

function readState(): InstallState {
  let flag = false;
  try {
    flag = localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    flag = false;
  }
  const ua = navigator.userAgent;
  const platform: InstallPlatform = /iPad|iPhone|iPod/.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other";
  const standalone = isStandaloneNow();
  const next = { standalone, installed: standalone || flag, canPrompt: deferredPrompt !== null, platform };
  // useSyncExternalStore aynı içerik için aynı nesneyi bekler.
  if (
    next.standalone !== cached.standalone ||
    next.installed !== cached.installed ||
    next.canPrompt !== cached.canPrompt ||
    next.platform !== cached.platform
  ) {
    cached = next;
  }
  return cached;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, readState, () => SERVER_STATE);
}

/** Tarayıcının kurulum penceresini açar; kullanıcı kabul ederse true. */
export async function promptInstall(): Promise<boolean> {
  const e = deferredPrompt;
  if (!e) return false;
  await e.prompt();
  const choice = await e.userChoice;
  deferredPrompt = null;
  if (choice.outcome === "accepted") markInstalled();
  notify();
  return choice.outcome === "accepted";
}
