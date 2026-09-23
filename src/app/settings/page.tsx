import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SETTINGS_LINKS, settingsHref } from "@/components/settings/settingsLinks";
import { SparkleIcon } from "@/components/icons";

export const metadata = { title: "Ayarlar | Parakip" };

/**
 * Ayar ekranlarının ortak üst sayfası — /settings/* alt sayfalarının geri
 * butonu buraya döner (bkz. lib/navigation/parentRoutes.ts). İçerik
 * profil menüsüyle AYNI listeden (settingsLinks.ts) üretilir.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { space } = await searchParams;
  const spaceParam = space && /^[0-9a-f-]{36}$/i.test(space) ? space : null;
  const links = [
    ...SETTINGS_LINKS.filter((l) => l.href !== "/help"),
    { href: "/settings/theme", label: "Görünüm", description: "Gündüz, gece veya sistem teması", icon: SparkleIcon },
  ];

  return (
    <AppShell variant="subpage" title="Ayarlar" parentHref={spaceParam ? `/home?space=${spaceParam}` : "/home"}>
      <ul className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface mt-3">
        {links.map((item, i) => (
          <li key={item.href} className={i > 0 ? "border-t border-border" : ""}>
            {item.comingSoon ? (
              <div aria-disabled="true" className="flex min-w-0 items-center gap-3 px-4 py-3.5 text-text-muted">
                <item.icon size={18} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs">{item.description}</span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold">Yakında</span>
              </div>
            ) : (
              <Link
                href={settingsHref(item, spaceParam)}
                className="flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <item.icon size={18} className="shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-primary">{item.label}</span>
                  <span className="block truncate text-xs text-text-muted">{item.description}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
