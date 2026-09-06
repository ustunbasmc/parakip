/**
 * Basit CSV üretimi — Türkçe Excel uyumluluğu için UTF-8 BOM + noktalı
 * virgül (;) ayracı kullanılır (Excel, Türkçe/Avrupa yerel ayarlarında
 * virgülü ondalık ayraç saydığından standart "," CSV'yi bozar).
 */
function escapeCell(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

/** Yalnızca tarayıcıda çalışır — Blob ile indirme tetikler, sahte/boş dosya oluşturmaz. */
export function triggerCsvDownload(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
