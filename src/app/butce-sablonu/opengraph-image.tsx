import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Ücretsiz aylık bütçe şablonu";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Ücretsiz · Excel ve online",
    title: "Aylık bütçe şablonu",
    subtitle: "Gelir ve giderlerini gir; ihtiyaç, istek ve birikim dağılımın anında hesaplansın.",
  });
}
