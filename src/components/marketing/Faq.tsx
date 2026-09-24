import { SectionHeading } from "@/components/marketing/MarketingShell";
import { JsonLd, faqJsonLd, type FaqItem } from "@/components/marketing/JsonLd";

/** Sık sorulan sorular + FAQPage yapılandırılmış verisi (JS gerektirmez). */
export function Faq({ items, title = "Sık sorulan sorular", id = "sss" }: { items: FaqItem[]; title?: string; id?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" id={id} aria-labelledby={`${id}-baslik`}>
      <SectionHeading id={`${id}-baslik`} title={title} />
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-border bg-surface px-5 py-4 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-bold text-text-primary [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="shrink-0 text-xl leading-none text-accent transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</p>
          </details>
        ))}
      </div>
      <JsonLd data={faqJsonLd(items)} />
    </section>
  );
}
