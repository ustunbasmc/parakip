import { getTimeGreeting } from "@/lib/format/greeting";
import { BuildingIcon } from "@/components/icons";

/**
 * "Sade ama güçlü karşılama alanı" — kullanıcıya kimin/hangi alanın
 * verisine baktığını anında hissettirir. Alan türü (Ev/İşletme) küçük bir
 * rozetle gösterilir; alan değiştirici başlıktaki SpaceSwitcher'dadır.
 */
export function GreetingHeader({
  displayName,
  spaceName,
  spaceType,
}: {
  displayName: string | null;
  spaceName: string;
  spaceType?: "home" | "business";
}) {
  const greeting = getTimeGreeting();

  return (
    <div className="animate-rise min-w-0 pt-1">
      <p className="text-sm font-medium text-text-muted">
        {greeting}
        {displayName ? `, ${displayName}` : ""}
      </p>
      <div className="mt-0.5 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate text-2xl font-extrabold tracking-tight text-text-primary">{spaceName}</h1>
        {spaceType ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              spaceType === "business" ? "bg-balance-soft text-balance" : "bg-accent-soft text-accent"
            }`}
          >
            {spaceType === "business" ? <BuildingIcon size={12} /> : null}
            {spaceType === "business" ? "İşletme" : "Ev"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
