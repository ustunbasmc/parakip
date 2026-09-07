import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/Button";

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        {/* Gerçek marka görseli — açık/koyu tema için AYRI dosyalar
            kullanılır (bu ikisi kendi arka planlarını taşıyan tam
            kompozisyonlardır, tek bir şeffaf logo değildir). Hangisinin
            gösterileceği globals.css'teki .dark kuralıyla belirlenir —
            next-themes hydrate olmadan ÖNCE bile doğru varyant görünür. */}
        <Image
          src="/brand/logo-light.png"
          alt="Parakip — Paran kontrolünde."
          width={480}
          height={320}
          priority
          className="theme-logo-light h-auto w-full max-w-[19rem]"
        />
        <Image
          src="/brand/logo-dark.png"
          alt="Parakip — Paran kontrolünde."
          width={480}
          height={320}
          priority
          className="theme-logo-dark h-auto w-full max-w-[19rem] rounded-3xl"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/sign-up">
          <Button variant="primary">Kayıt ol</Button>
        </Link>
        <Link href="/sign-in">
          <Button variant="secondary">Giriş yap</Button>
        </Link>
      </div>
    </div>
  );
}
