import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Logo className="scale-125" />
        <p className="max-w-[16rem] text-lg font-medium text-text-secondary">
          Paran kontrolünde.
        </p>
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
