import { GUIDES, getGuide } from "@/content/rehber";
import { OG_CONTENT_TYPE, OG_SIZE, clampText, renderOgImage } from "@/lib/og";

export const alt = "Parakip Rehber";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  return renderOgImage({
    eyebrow: `Parakip Rehber · ${guide?.readMinutes ?? 5} dk okuma`,
    title: guide?.short ?? "Bütçe, borç ve birikim rehberleri",
    subtitle: guide ? clampText(guide.description, 120) : undefined,
    showCard: false,
  });
}
