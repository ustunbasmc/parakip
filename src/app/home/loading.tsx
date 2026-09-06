import { AppShell } from "@/components/AppShell";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 h-3 w-24 rounded bg-surface-muted" />
      <div className="h-7 w-32 rounded bg-surface-muted" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <AppShell title="Parakip">
      <div className="flex flex-col gap-4 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </AppShell>
  );
}
