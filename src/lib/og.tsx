import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Paylaşım görselleri (Open Graph, 1200×630). Tüm sayfalar aynı şablonu
 * başlık/alt başlıkla kullanır. Yazı tipi: Manrope (latin + latin-ext,
 * Türkçe karakterler için ikisi birlikte yüklenir; eksik glif diğerinden
 * alınır). Dosyalar assets/fonts altında, logo public/brand altında.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 600 | 800; style: "normal" }[]; logo: string }> | null = null;

function loadAssets() {
  assets ??= (async () => {
    const dir = join(process.cwd(), "assets/fonts");
    const [l6, e6, l8, e8, icon] = await Promise.all([
      readFile(join(dir, "manrope-latin-600-normal.woff")),
      readFile(join(dir, "manrope-latin-ext-600-normal.woff")),
      readFile(join(dir, "manrope-latin-800-normal.woff")),
      readFile(join(dir, "manrope-latin-ext-800-normal.woff")),
      readFile(join(process.cwd(), "public/brand/icon-192.png")),
    ]);
    return {
      fonts: [
        { name: "Manrope", data: l6, weight: 600, style: "normal" },
        { name: "Manrope", data: e6, weight: 600, style: "normal" },
        { name: "Manrope", data: l8, weight: 800, style: "normal" },
        { name: "Manrope", data: e8, weight: 800, style: "normal" },
      ],
      logo: `data:image/png;base64,${icon.toString("base64")}`,
    };
  })();
  return assets;
}

/** Uzun metni kelime sınırında keser (görselde yarım kelime kalmasın). */
export function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)).replace(/[,.;:\s]+$/, "")}…`;
}

export async function renderOgImage({
  eyebrow,
  title,
  subtitle,
  showCard = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showCard?: boolean;
}) {
  const { fonts, logo } = await loadAssets();
  const titleSize = title.length > 60 ? 52 : title.length > 38 ? 60 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #0a1120 0%, #0d1a2e 55%, #0f2a2c 100%)",
          fontFamily: "Manrope",
          color: "#f1f5f9",
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -200,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(45,212,191,0.35) 0%, rgba(45,212,191,0) 70%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: showCard ? 700 : 1056, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={56} height={56} style={{ borderRadius: 14 }} alt="" />
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>parakip</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {eyebrow ? (
              <div style={{ display: "flex" }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#2dd4bf",
                    background: "rgba(45,212,191,0.14)",
                    padding: "8px 18px",
                    borderRadius: 9999,
                  }}
                >
                  {eyebrow}
                </span>
              </div>
            ) : null}
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
            {subtitle ? <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#a6b4cc", lineHeight: 1.35 }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#71809c" }}>www.parakip.com · Ücretsiz başla, kart gerekmez</div>
        </div>

        {showCard ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginLeft: "auto", marginTop: 90, width: 330 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 26,
                borderRadius: 28,
                background: "linear-gradient(135deg, #123c38 0%, #131c33 70%)",
                border: "1px solid rgba(45,212,191,0.35)",
                boxShadow: "0 30px 60px -20px rgba(45,212,191,0.35)",
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 600, color: "#a6b4cc" }}>Toplam varlık</span>
              <span style={{ fontSize: 44, fontWeight: 800, marginTop: 6, letterSpacing: -1 }}>48.320 TL</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#2dd4bf", marginTop: 10 }}>Geçen aya göre %12 daha az harcadın</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 18, borderRadius: 20, background: "#131c33", border: "1px solid #263352" }}>
                <span style={{ fontSize: 16, color: "#71809c" }}>Gelir</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#2dd4bf", whiteSpace: "nowrap" }}>+32.500 TL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 18, borderRadius: 20, background: "#131c33", border: "1px solid #263352" }}>
                <span style={{ fontSize: 16, color: "#71809c" }}>Gider</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fb7185", whiteSpace: "nowrap" }}>-18.240 TL</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
