/**
 * Tutar girişi için saf (DOM'suz, kolayca test edilebilir) yardımcı
 * fonksiyonlar. Türkçe klavyede ondalık ayırıcı VİRGÜLdür; kullanıcılar
 * yine de nokta da yazabilir (bazı klavye düzenleri/alışkanlıklar/binlik
 * ayraç alışkanlığı) — ayırıcı türü aşağıdaki kurala göre tespit edilir.
 *
 * EKSİ İŞARETİ KURALI: '-' YALNIZCA girişin en başında (veya baştaki
 * boşluklardan hemen sonra) geçerli kabul edilir. Metnin ortasında veya
 * birden fazla kez yazılan '-' işaretleri düzeltilir (sayıyı negatif
 * yapmaz, başa taşınmaz) AMA BU SESSİZCE YAPILMAZ: sanitizeAmountInput,
 * bu durumda `invalidMinusUsage: true` döner ki arayüz kullanıcıya "eksi
 * işareti yalnızca başta kullanılabilir" gibi GÖRÜNÜR bir mesaj
 * gösterebilsin. Veri sessizce değiştirilip kullanıcıya hiç
 * bildirilmemesi kasıtlı olarak ÖNLENMİŞTİR.
 */

export interface AmountSanitizeResult {
  /** Temizlenmiş, giriş alanında gösterilecek değer. */
  value: string;
  /**
   * true ise, ham girişte eksi işareti KURALA UYMUYORDU (başta değil,
   * birden fazla kez yazılmış, veya allowNegative=false iken hiç
   * kullanılmış) ve düzeltildi. Arayüz bu durumda kullanıcıya GÖRÜNÜR bir
   * uyarı/hata göstermelidir — bu bayrağı yok sayıp sessiz kalmak, "sessiz
   * veri dönüşümü" yasağını ihlal eder.
   */
  invalidMinusUsage: boolean;
}

/** Kullanıcının yazdığı ham metni, geçerli bir tutar gösterimine indirger. */
export function sanitizeAmountInput(raw: string, allowNegative: boolean): AmountSanitizeResult {
  // Baştaki boşluklar yok sayılır ("bastaki bosluklardan sonra da eksi
  // gecerli olsun" kuralı için) — geri kalan metin aynen korunur.
  const trimmedStart = raw.replace(/^\s+/, "");

  // Baştaki TÜM ardışık '-' işaretlerini (1 veya daha fazla) tespit et.
  const leadingMinusMatch = trimmedStart.match(/^-+/);
  const leadingMinusCount = leadingMinusMatch ? leadingMinusMatch[0].length : 0;

  const isNegative = allowNegative && leadingMinusCount > 0;
  let rest = trimmedStart.slice(leadingMinusCount);

  // GEÇERSİZ KULLANIM TESPİTİ (henüz hiçbir '-' silinmeden, ham veriye
  // bakarak):
  //  - allowNegative=false iken herhangi bir '-' varsa -> geçersiz
  //    (bu alanda negatif tutara hiç izin yok).
  //  - allowNegative=true iken: baştaki bloktan SONRA kalan metinde hâlâ
  //    bir '-' varsa (ortada/sonda yazılmış) VEYA baştaki blokta birden
  //    fazla '-' varsa (ör. "--150") -> geçersiz.
  const strayMinusAfterLeadingBlock = rest.includes("-");
  const excessLeadingMinus = leadingMinusCount > 1;
  const invalidMinusUsage = allowNegative
    ? strayMinusAfterLeadingBlock || excessLeadingMinus
    : raw.includes("-");

  // Artık kalan metindeki TÜM '-' işaretleri geçersizdir — sessizce atılır
  // (ama invalidMinusUsage=true olarak yukarıda zaten işaretlendi, arayüz
  // bunu görebilir).
  rest = rest.replace(/-/g, "");

  // Yalnızca rakam, virgül ve nokta kalsın; harfler, boşluklar, TL işareti
  // gibi başka her şey sessizce atılır (bunlar için ayrı bir hata durumu
  // istenmedi — yalnızca eksi işareti kuralı için isteniyor).
  rest = rest.replace(/[^0-9,.]/g, "");

  // AYIRICI TÜRÜ TESPİTİ (virgül vs. nokta, ondalık vs. binlik):
  //  - Virgül VARSA: virgül ondalık ayırıcıdır; metindeki TÜM noktalar
  //    binlik ayraç kabul edilip atılır (ör. "1.234,56" -> "1234,56").
  //  - Virgül YOKSA ama nokta VARSA: yalnızca TEK bir nokta olup ondan
  //    sonra 1-2 rakam varsa bu nokta ondalık ayırıcı sayılır (ör.
  //    "150.5" -> "150,5"). Aksi halde (birden fazla nokta, ya da nokta
  //    sonrası 3+ rakam — ör. "1.500" veya "1.234.567") TÜM noktalar
  //    binlik ayraç kabul edilip atılır (ör. "1.500" -> "1500", tam sayı).
  if (rest.includes(",")) {
    rest = rest.replace(/\./g, "");
  } else {
    const dotCount = (rest.match(/\./g) ?? []).length;
    const lastDotIndex = rest.lastIndexOf(".");
    const digitsAfterLastDot = lastDotIndex === -1 ? 0 : rest.length - lastDotIndex - 1;

    if (dotCount === 1 && digitsAfterLastDot > 0 && digitsAfterLastDot <= 2) {
      rest = rest.replace(".", ",");
    } else {
      rest = rest.replace(/\./g, "");
    }
  }

  // Yalnızca ilk virgülü ondalık ayırıcı olarak koru; sonrasında gelen
  // fazladan virgülleri ve 2'den fazla ondalık basamağı kırp.
  const firstComma = rest.indexOf(",");
  if (firstComma !== -1) {
    const before = rest.slice(0, firstComma + 1);
    const after = rest
      .slice(firstComma + 1)
      .replace(/,/g, "")
      .slice(0, 2);
    rest = before + after;
  }

  return { value: (isNegative ? "-" : "") + rest, invalidMinusUsage };
}

/** Sanitize edilmiş bir metni kuruşa (integer) çevirir; geçersizse null. */
export function amountInputToCents(value: string): number | null {
  const normalized = value.replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

/** Kuruş cinsinden bir tutarı, giriş alanında gösterilecek metne çevirir. */
export function centsToAmountInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole},${frac}`;
}

/** Kuruş cinsinden bir tutarı, salt görüntüleme için TL formatına çevirir. */
export function formatCentsAsTl(cents: number): string {
  return formatCentsAsCurrency(cents, "TRY");
}

/**
 * Kuruş (veya ilgili para biriminin en küçük birimi) cinsinden bir tutarı,
 * BELİRTİLEN para biriminde, Türkçe (tr-TR) sayı biçimlendirme kurallarıyla
 * gösterir (binlik nokta, ondalık virgül). Çoklu para birimi kartlarında
 * (yatırım portföyü gibi) OTOMATİK dönüşüm YAPILMADAN, her para biriminin
 * kendi tutarını doğru göstermek için kullanılır.
 */
export function formatCentsAsCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
