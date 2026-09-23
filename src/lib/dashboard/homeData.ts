import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHoldings } from "@/lib/dashboard/investments";
import { getTotalBalanceByCurrency } from "@/lib/dashboard/queries";

/**
 * Ana sayfa bölümleri ayrı Suspense sınırlarında (akışlı) yüklenir. Aynı
 * veriyi birden fazla bölüm kullandığında (ör. yatırımlar hem "Toplam
 * varlık" hem "Yatırımlar" kartında) sorgunun İSTEK BAŞINA bir kez
 * çalışması için React cache() ile sarılır. Sorgu mantığı DEĞİŞMEZ —
 * yalnızca tekrar çağrılar birleştirilir. Önbellek yalnızca tek bir sunucu
 * isteği boyunca yaşar; kullanıcılar veya istekler arasında paylaşılmaz.
 */
export const getHoldingsCached = cache((supabase: SupabaseClient, bookId: string) => getHoldings(supabase, bookId));

export const getBalancesCached = cache((supabase: SupabaseClient, bookId: string) =>
  getTotalBalanceByCurrency(supabase, bookId)
);
