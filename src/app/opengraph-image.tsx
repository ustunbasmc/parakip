import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Parakip — Paranın nereye gittiğini ilk ay gör";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Ev ve işletme için ücretsiz",
    title: "Paranın nereye gittiğini ilk ay gör.",
    subtitle: "Gelir-gider, bütçe, borç-alacak ve birikim takibi tek uygulamada.",
  });
}
