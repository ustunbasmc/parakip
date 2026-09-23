/**
 * Çevrimdışı salt okunur görünüm için cihazdaki özet kopya (IndexedDB).
 *
 * KAPSAM: Yalnızca özet — hesap bakiyeleri, son işlemler, bu ayın
 * bütçeleri, açık borç/alacaklar ve bu ayın gelir/gideri. Hiçbir yazma
 * işlemi bu kopyadan yapılmaz; tek doğru kaynak her zaman sunucudur.
 *
 * GÜVENLİK:
 *  - Kopya oturum sahibinin kullanıcı kimliğiyle saklanır; farklı bir
 *    kullanıcı veya oturumsuz durumda gösterilmez ve silinir.
 *  - Çıkış yapınca silinir (clearOfflineSnapshots).
 *  - Kullanıcı Ayarlar → Güvenlik'ten özelliği kapatabilir; kapalıyken
 *    kopya alınmaz ve mevcut kopya silinir.
 * Tüm fonksiyonlar tarayıcıda çalışır ve hata durumunda sessizce vazgeçer
 * (özel pencere, depolama engeli vb.) — uygulamanın çevrimiçi çalışmasını
 * asla bozmaz.
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SnapshotAccount {
  name: string;
  type: string;
  currency: string;
  balanceCents: number;
  isArchived: boolean;
}

export interface SnapshotTransaction {
  type: "income" | "expense" | "transfer";
  amountCents: number;
  currency: string;
  note: string | null;
  occurredAt: string;
  accountName: string | null;
}

export interface SnapshotBudget {
  name: string;
  budgetCents: number;
  usedCents: number;
  percentUsed: number;
  alertLevel: "ok" | "warning_80" | "exceeded";
}

export interface SnapshotDebt {
  counterpartyName: string;
  direction: "payable" | "receivable";
  remainingCents: number;
  dueDate: string | null;
}

export interface SnapshotSpace {
  id: string;
  name: string;
  type: "home" | "business";
  accounts: SnapshotAccount[];
  transactions: SnapshotTransaction[];
  budgets: SnapshotBudget[];
  debts: SnapshotDebt[];
  monthIncome: { currency: string; cents: number }[];
  monthExpense: { currency: string; cents: number }[];
}

export interface OfflineSnapshot {
  schema: number;
  userId: string;
  savedAt: string;
  spaces: SnapshotSpace[];
}

const DB_NAME = "parakip-offline";
const STORE = "snapshots";
const OPT_OUT_KEY = "parakip.offlineSnapshot";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "userId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => {
            db.close();
            resolve(req ? (req.result as T) : null);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      })
  );
}

export function saveOfflineSnapshot(snapshot: OfflineSnapshot): Promise<unknown> {
  // Tek kullanıcılık kopya: başka kullanıcıların kopyaları önce silinir.
  return run("readwrite", (store) => {
    store.clear();
    store.put(snapshot);
  });
}

export async function readOfflineSnapshot(userId: string): Promise<OfflineSnapshot | null> {
  const snap = await run<OfflineSnapshot | undefined>("readonly", (store) => store.get(userId));
  if (!snap || snap.schema !== SNAPSHOT_SCHEMA_VERSION) return null;
  return snap;
}

/** Cihazdaki tüm çevrimdışı kopyaları siler (çıkışta, kullanıcı değişince, özellik kapatılınca). */
export async function clearOfflineSnapshots(): Promise<void> {
  await run("readwrite", (store) => {
    store.clear();
  });
}

export function isOfflineSnapshotEnabled(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== "off";
  } catch {
    return true;
  }
}

export async function setOfflineSnapshotEnabled(enabled: boolean): Promise<void> {
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, "off");
  } catch {
    // Tercih kaydedilemezse varsayılan (açık) geçerli kalır.
  }
  if (!enabled) await clearOfflineSnapshots();
}

/**
 * Tarayıcıda bir Supabase oturum çerezi var mı? (Ağ gerektirmez.) Çıkış
 * yapılınca çerez silinir; bu durumda kopya gösterilmez.
 */
export function hasSessionCookie(): boolean {
  try {
    return document.cookie.split(";").some((c) => {
      const name = c.trim().split("=")[0];
      return name.startsWith("sb-") && name.includes("-auth-token");
    });
  } catch {
    return false;
  }
}
