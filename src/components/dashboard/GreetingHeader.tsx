import { getTimeGreeting } from "@/lib/format/greeting";

/**
 * "Sade ama güçlü karşılama alanı" — dekoratif değil, kullanıcıya
 * kimin/hangi alanın verisine baktığını anında hissettirir. displayName
 * varsa kişiselleştirir, yoksa alan adıyla tek başına da doğal durur.
 */
export function GreetingHeader({
  displayName,
  spaceName,
}: {
  displayName: string | null;
  spaceName: string;
}) {
  const greeting = getTimeGreeting();

  return (
    <div className="pt-1">
      <p className="text-sm font-medium text-text-muted">
        {greeting}
        {displayName ? `, ${displayName}` : ""}
      </p>
      <h1 className="text-xl font-bold text-text-primary">{spaceName}</h1>
    </div>
  );
}
