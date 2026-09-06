"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/welcome");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleSignOut} fullWidth={false}>
      Çıkış yap
    </Button>
  );
}
