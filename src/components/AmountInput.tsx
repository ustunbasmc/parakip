"use client";

import { useId, useState } from "react";
import { sanitizeAmountInput } from "@/lib/format/amount";

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowNegative?: boolean;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
}

const INVALID_MINUS_MESSAGE_NEGATIVE_ALLOWED =
  "Eksi işareti yalnızca en başta kullanılabilir; geçersiz '-' yok sayıldı.";
const INVALID_MINUS_MESSAGE_NEGATIVE_DISALLOWED = "Bu alana negatif tutar girilemez.";

/**
 * inputMode="decimal" + type="text" KASITLI: type="number" mobil
 * klavyelerde (özellikle Türkçe düzende) virgülü/eksiyi tutarsız gösterir
 * veya hiç göstermez. Metin girişi + manuel sanitize, hem Türkçe virgülü
 * hem gider tutarları için '-' işaretini güvenilir şekilde destekler.
 *
 * GÖRÜNÜRLÜK KURALI: sanitizeAmountInput geçersiz bir eksi kullanımını
 * (başta değil, birden fazla, veya izin verilmeyen bir alanda) SESSİZCE
 * düzeltmez — invalidMinusUsage bayrağını döner ve bu bileşen bunu
 * KULLANICIYA GÖRÜNÜR bir uyarı olarak gösterir. Veri arka planda
 * değişirken kullanıcının bundan habersiz kalması engellenmiştir.
 */
export function AmountInput({
  label,
  value,
  onChange,
  allowNegative = false,
  error,
  hint,
  autoFocus,
}: AmountInputProps) {
  const id = useId();
  const [minusWarning, setMinusWarning] = useState(false);

  function handleChange(raw: string) {
    const result = sanitizeAmountInput(raw, allowNegative);
    onChange(result.value);
    setMinusWarning(result.invalidMinusUsage);
  }

  // Öncelik sırası: dışarıdan gelen (ör. gönderim anı) hata > bu alanın
  // kendi eksi-işareti uyarısı > genel ipucu. İkisi aynı anda gösterilmez,
  // ama minusWarning asla error'ı SESSİZCE gizlemez — error varsa zaten
  // daha önemlidir ve önce o gösterilir.
  const minusMessage = allowNegative
    ? INVALID_MINUS_MESSAGE_NEGATIVE_ALLOWED
    : INVALID_MINUS_MESSAGE_NEGATIVE_DISALLOWED;
  const showMinusWarning = !error && minusWarning;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="0,00"
          aria-invalid={Boolean(error) || minusWarning}
          className={`h-14 w-full rounded-2xl border bg-surface pl-4 pr-14 text-right text-xl font-semibold tabular-nums text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent ${
            error || minusWarning ? "border-danger" : "border-border"
          }`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base font-medium text-text-muted"
        >
          ₺
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : showMinusWarning ? (
        <p role="alert" className="text-sm text-danger">
          {minusMessage}
        </p>
      ) : hint ? (
        <p className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
