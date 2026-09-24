import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Parakip Rehber";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: "Parakip Rehber", title: "Bütçe, borç ve birikim rehberleri", subtitle: "Sade, uygulanabilir, Türkçe.", showCard: false });
}
