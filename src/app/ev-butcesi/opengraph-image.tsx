import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Parakip ile aile bütçeni birlikte yönet";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Ücretsiz aile bütçesi uygulaması",
    title: "Aile bütçeni birlikte, kavga etmeden yönet.",
    subtitle: "Harcama takibi, bütçe uyarıları ve birikim hedefleri.",
  });
}
