import Image from "next/image";
import { BuildingIcon, PieChartIcon, ShieldIcon } from "@/components/icons";

const FEATURES = [
  { Icon: BuildingIcon, title: "Ev ve işletme ayrı alanlarda", text: "Kişisel ve ticari paran birbirine karışmaz." },
  { Icon: PieChartIcon, title: "Bütçe, borç ve yatırım", text: "Harcamanı, alacağını ve portföyünü tek yerden izle." },
  { Icon: ShieldIcon, title: "Verilerin sana özel", text: "Kayıtların yalnızca sana ve davet ettiğin kişilere açık." },
];

/**
 * Giriş/kayıt ekranlarının masaüstü sol paneli. Marka kimliği temadan
 * bağımsızdır (her zaman koyu lacivert + turkuaz), bu yüzden renkler
 * burada sabittir. Orijinal uygulama ikonu (public/brand/icon-192.png)
 * kullanılır. Sağ alttaki uygulama önizlemesi YALNIZCA soyut şekillerden
 * oluşur — sahte finansal rakam gösterilmez. Harici/ağır görsel yoktur.
 */
export function AuthBrandPanel() {
  return (
    <aside
      className="relative hidden h-dvh flex-col justify-between overflow-hidden px-12 py-12 text-white lg:sticky lg:top-0 lg:flex xl:px-16"
      style={{
        background:
          "radial-gradient(90% 70% at 85% 10%, rgba(45,212,191,0.22) 0%, rgba(45,212,191,0) 60%), radial-gradient(70% 60% at 0% 100%, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0) 60%), linear-gradient(160deg, #0b1a2e 0%, #0a1120 55%, #070d19 100%)",
      }}
    >
      {/* İnce ızgara dokusu — teknolojik atmosfer, çok düşük opaklık. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(80% 70% at 50% 40%, #000 30%, transparent 80%)",
        }}
      />

      <div className="relative flex items-center gap-3">
        <Image src="/brand/icon-192.png" alt="" width={44} height={44} className="rounded-xl" priority />
        <span className="text-2xl font-extrabold tracking-tight">parakip</span>
      </div>

      <div className="relative max-w-lg">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
          Paran <span style={{ color: "#2dd4bf" }}>kontrolünde.</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">
          Evinin ve işletmenin gelir, gider, hesap, borç ve yatırımlarını tek, sade bir uygulamada yönet.
        </p>

        <ul className="mt-10 flex flex-col gap-4">
          {FEATURES.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "rgba(45,212,191,0.12)", color: "#2dd4bf", boxShadow: "inset 0 0 0 1px rgba(45,212,191,0.25)" }}
              >
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-slate-400">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Soyut uygulama önizlemesi — rakam yok, yalnızca yapı. */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-10 hidden w-64 rotate-[-8deg] xl:block">
        <div
          className="rounded-[2.2rem] border p-3"
          style={{ borderColor: "rgba(148,163,184,0.25)", background: "rgba(15,23,42,0.7)", boxShadow: "0 30px 80px -20px rgba(45,212,191,0.35)" }}
        >
          <div className="rounded-[1.7rem] p-4" style={{ background: "linear-gradient(160deg, #11323a, #0f1e33)" }}>
            <div className="h-2 w-16 rounded-full bg-white/25" />
            <div className="mt-3 h-6 w-36 rounded-lg bg-white/80" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/25 p-2.5">
                <div className="h-2 w-10 rounded-full" style={{ background: "#2dd4bf" }} />
                <div className="mt-2 h-3 w-16 rounded bg-white/60" />
              </div>
              <div className="rounded-xl bg-black/25 p-2.5">
                <div className="h-2 w-10 rounded-full" style={{ background: "#fb7185" }} />
                <div className="mt-2 h-3 w-14 rounded bg-white/60" />
              </div>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5 rounded-xl bg-black/20 p-2">
              {[40, 65, 50, 80, 60, 95].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 5 ? "#2dd4bf" : "rgba(45,212,191,0.4)" }} />
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-black/20 p-2">
                  <div className="h-6 w-6 rounded-lg" style={{ background: i ? "rgba(251,113,133,0.3)" : "rgba(45,212,191,0.3)" }} />
                  <div className="h-2 flex-1 rounded-full bg-white/30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Parakip</p>
    </aside>
  );
}
