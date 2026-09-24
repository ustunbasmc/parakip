import Link from "next/link";
import type { ComponentType } from "react";
import { CheckIcon } from "@/components/icons";
import { SectionHeading } from "@/components/marketing/MarketingShell";

/** Tanıtım sayfalarının ortak bölümleri (sunucu bileşenleri). */

export interface Benefit {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  text: string;
}

export function HeroCtas({ primaryHref, primaryLabel = "Ücretsiz başla", secondaryHref, secondaryLabel }: {
  primaryHref: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Link href={primaryHref} className="rounded-2xl bg-accent px-7 py-3.5 text-center text-base font-bold text-text-on-accent shadow-[var(--shadow-hero)]">
        {primaryLabel}
      </Link>
      {secondaryHref ? (
        <a href={secondaryHref} className="rounded-2xl border border-border bg-surface px-7 py-3.5 text-center text-base font-semibold text-text-primary">
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  );
}

export function TrustList({ items, vertical = false }: { items: string[]; vertical?: boolean }) {
  return (
    <ul className={vertical ? "flex flex-col gap-3 text-sm text-text-secondary" : "flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted"}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function BenefitGrid({ items }: { items: Benefit[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon size={19} />
          </span>
          <h3 className="text-[15px] font-bold leading-snug text-text-primary">{title}</h3>
          <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
        </div>
      ))}
    </div>
  );
}

export function StepsSection({
  id,
  title = "3 adımda başla",
  steps,
  ctaHref,
  ctaLabel = "Hemen ücretsiz başla",
}: {
  id?: string;
  title?: string;
  steps: { title: string; text: string }[];
  ctaHref: string;
  ctaLabel?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id={id} aria-labelledby={`${id ?? "adim"}-baslik`}>
      <SectionHeading id={`${id ?? "adim"}-baslik`} title={title} description="Kurulum birkaç dakika sürer. İstediğin an bırakabilirsin." />
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex flex-col gap-2 rounded-3xl border border-border bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg font-extrabold text-text-on-accent">{i + 1}</span>
            <h3 className="mt-2 text-lg font-bold text-text-primary">{s.title}</h3>
            <p className="text-sm leading-relaxed text-text-secondary">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex justify-center">
        <Link href={ctaHref} className="rounded-2xl bg-accent px-7 py-3.5 text-base font-bold text-text-on-accent">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

export function ProblemSolution({ title, items }: { title: string; items: { problem: string; solution: string }[] }) {
  return (
    <section className="border-y border-border bg-surface/40 px-4 py-16 sm:px-6" aria-labelledby="sorun-baslik">
      <div className="mx-auto max-w-5xl">
        <SectionHeading id="sorun-baslik" title={title} />
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((i) => (
            <div key={i.problem} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-6">
              <p className="text-[15px] font-bold text-text-primary">“{i.problem}”</p>
              <p className="flex gap-2 text-sm leading-relaxed text-text-secondary">
                <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>{i.solution}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ href, title, text, label = "Ücretsiz hesap oluştur" }: { href: string; title: string; text: string; label?: string }) {
  return (
    <section className="px-4 pb-20 pt-4 sm:px-6">
      <div
        className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-[2rem] border px-6 py-12 text-center"
        style={{
          backgroundImage: "var(--gradient-hero)",
          boxShadow: "var(--shadow-hero)",
          borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
        }}
      >
        <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">{title}</h2>
        <p className="max-w-lg text-text-secondary">{text}</p>
        <Link href={href} className="rounded-2xl bg-accent px-8 py-3.5 text-base font-bold text-text-on-accent">
          {label}
        </Link>
      </div>
    </section>
  );
}
