import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Parakip ile esnaf gelir-gider takibi";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Esnaf ve küçük işletme için",
    title: "Defteri bırak, gelir-giderini telefondan tut.",
    subtitle: "Kasa, veresiye, tedarikçi borcu ve aylık kâr-zarar.",
  });
}
