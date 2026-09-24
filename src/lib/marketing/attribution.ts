/**
 * Kayıt kaynağı: kullanıcının hangi sayfadan / hangi kampanyadan geldiği.
 * Çerez veya tarayıcı deposu KULLANILMAZ — tanıtım sayfalarındaki "Ücretsiz
 * başla" bağlantıları bu bilgiyi adreste taşır, kayıt sırasında kullanıcı
 * kaydına (auth user_metadata.signup_source) bir kez yazılır. Kişisel veri
 * içermez; değerler kısa ve güvenli karakterlerle sınırlıdır.
 */

export interface SignupSource {
  page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const SAFE = /^[\w.\-]{1,60}$/;
const PAGE = /^\/[a-z0-9\-/]{0,60}$/;

type ParamSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string | undefined {
  const raw = typeof (params as { get?: unknown }).get === "function"
    ? (params as { get(name: string): string | null }).get(key)
    : (params as Record<string, string | string[] | undefined>)[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ?? undefined;
}

/** Adresteki `src` ve `utm_*` değerlerini güvenli biçimde okur. */
export function parseSignupSource(params: ParamSource): SignupSource | null {
  const out: SignupSource = {};
  const page = read(params, "src");
  if (page && PAGE.test(page)) out.page = page;
  for (const k of KEYS) {
    const v = read(params, k);
    if (v && SAFE.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Kaynağı bir sonraki adresin sorgusuna ekler (`src`, `utm_*`). */
export function sourceQuery(source: SignupSource | null): string {
  if (!source) return "";
  const q = new URLSearchParams();
  if (source.page) q.set("src", source.page);
  for (const k of KEYS) if (source[k]) q.set(k, source[k] as string);
  return q.toString();
}

/** Tanıtım sayfasındaki kayıt bağlantısı. */
export function signupHref(opts: { plan?: string | null; type?: string | null; page: string; utm?: SignupSource | null }): string {
  const q = new URLSearchParams();
  if (opts.plan) q.set("plan", opts.plan);
  if (opts.type) q.set("type", opts.type);
  const source: SignupSource = { ...(opts.utm ?? {}), page: opts.page };
  for (const [k, v] of new URLSearchParams(sourceQuery(source))) q.set(k, v);
  const s = q.toString();
  return `/sign-up${s ? `?${s}` : ""}`;
}
