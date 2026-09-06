"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSpaceWithBook } from "@/lib/api/onboarding-rpc";
import { ScreenShell } from "@/components/ScreenShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

const DEFAULT_NAMES: Record<string, string> = {
  home: "Ev",
  business: "İşletmem",
};

const TITLES: Record<string, string> = {
  home: "Ev alanını oluştur",
  business: "İşletme alanını oluştur",
};

function CreateSpaceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "business" ? "business" : "home";
  const then = searchParams.get("then");

  const [name, setName] = useState(DEFAULT_NAMES[type]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      setError("Alan adı boş olamaz.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await createSpaceWithBook(supabase, {
      p_type: type,
      p_name: name.trim(),
    });
    setLoading(false);

    if (rpcError || !data) {
      setError(
        rpcError?.message?.includes("spaces_one_home_per_user")
          ? "Zaten bir Ev alanın var."
          : "Alan oluşturulamadı. Lütfen tekrar dene."
      );
      return;
    }

    if (then === "business" || then === "home") {
      router.push(`/onboarding/create-space?type=${then}`);
      return;
    }

    router.push(`/onboarding/first-account?book_id=${data.book_id}`);
  }

  return (
    <ScreenShell
      backFallbackHref="/onboarding/space-type"
      footer={
        <Button type="submit" form="create-space-form" loading={loading}>
          Devam et
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {TITLES[type]}
          </h1>
          <p className="mt-1 text-text-secondary">
            İstersen adını değiştirebilirsin, sonra da düzenleyebilirsin.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form id="create-space-form" onSubmit={handleSubmit}>
          <TextField
            label="Alan adı"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
      </div>
    </ScreenShell>
  );
}

export default function CreateSpacePage() {
  return (
    <Suspense fallback={null}>
      <CreateSpaceForm />
    </Suspense>
  );
}
