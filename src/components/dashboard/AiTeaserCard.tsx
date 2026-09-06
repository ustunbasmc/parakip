import { SparkleIcon } from "@/components/icons";

export function AiTeaserCard() {
  return (
    <section
      className="rounded-2xl border border-dashed p-4"
      style={{ borderColor: "var(--color-border-strong)" }}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <SparkleIcon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Yapay zekâ finans asistanı</p>
          <p className="truncate text-xs text-text-muted">
            Harcama analizleri ve doğal dille sorular yakında burada.
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-muted">
          Yakında
        </span>
      </div>
    </section>
  );
}
