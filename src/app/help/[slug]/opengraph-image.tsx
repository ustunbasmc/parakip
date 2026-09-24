import { createClient } from "@supabase/supabase-js";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Parakip Yardım Merkezi";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Makale başlığı herkese açık okuma izniyle (anon, migration 0070) alınır. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = "Yardım Merkezi";
  if (/^[a-z0-9-]{1,120}$/.test(slug)) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await supabase.from("help_articles").select("title").eq("slug", slug).maybeSingle();
    if (data?.title) title = data.title;
  }
  return renderOgImage({ eyebrow: "Parakip Yardım Merkezi", title, showCard: false });
}
