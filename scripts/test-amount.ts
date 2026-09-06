import {
  sanitizeAmountInput,
  amountInputToCents,
  centsToAmountInput,
  formatCentsAsTl,
} from "../src/lib/format/amount";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${label} -> alınan=${JSON.stringify(actual)} beklenen=${JSON.stringify(expected)}`);
  if (ok) pass++;
  else fail++;
}

/** sanitizeAmountInput'u hem value hem invalidMinusUsage bayrağıyla test eder. */
function checkSanitize(
  label: string,
  raw: string,
  allowNegative: boolean,
  expectedValue: string,
  expectedInvalidMinus: boolean
) {
  const result = sanitizeAmountInput(raw, allowNegative);
  check(`${label} [value]`, result.value, expectedValue);
  check(`${label} [invalidMinusUsage]`, result.invalidMinusUsage, expectedInvalidMinus);
}

console.log("### sanitizeAmountInput — temel senaryolar (hiçbiri geçersiz eksi içermiyor) ###");
checkSanitize("basit rakam", "150", false, "150", false);
checkSanitize("virgülle ondalık", "150,5", false, "150,5", false);
checkSanitize("nokta -> virgüle çevrilir (tek nokta, 1-2 basamak)", "150.75", false, "150,75", false);
checkSanitize("2 basamaktan fazla ondalık kırpılır", "150,7599", false, "150,75", false);
checkSanitize("ikinci virgül yok sayılır", "150,7,5", false, "150,75", false);
checkSanitize("harfler atılır", "15a0b,5x0", false, "150,50", false);
checkSanitize("boş girdi", "", true, "", false);
checkSanitize("TL işareti atılır", "150 ₺", false, "150", false);

console.log("");
console.log("### GEÇERLİ eksi kullanımı (invalidMinusUsage=false olmalı) ###");
checkSanitize("eksi izin verilirse VE baştaysa korunur", "-150", true, "-150", false);
checkSanitize("baştaki boşluktan sonra eksi de geçerli", "  -150", true, "-150", false);
checkSanitize("yalnızca eksi (hâlâ yazılıyor, geçerli/eksiksiz)", "-", true, "-", false);

console.log("");
console.log("### GEÇERSİZ eksi kullanımı — artık SESSİZCE değil, invalidMinusUsage=true ile işaretleniyor ###");
checkSanitize("eksi izin verilmezse atılır VE geçersiz işaretlenir", "-150", false, "150", true);
checkSanitize("15-0 -> pozitif 150, ama HATA bayrağı true (öncesi sessizce -150 oluyordu)", "15-0", true, "150", true);
checkSanitize("1-2-3 -> pozitif 123, hata bayrağı true", "1-2-3", true, "123", true);
checkSanitize("150- (sondaki eksi) -> pozitif 150, hata bayrağı true", "150-", true, "150", true);
checkSanitize("15-0-,5-0 -> pozitif 150,50, hata bayrağı true", "15-0-,5-0", true, "150,50", true);
checkSanitize("--150 (fazladan baştaki eksi) -> -150'ye indirgenir AMA hata bayrağı true", "--150", true, "-150", true);
checkSanitize("-15-0 (başta + ortada eksi) -> -150, hata bayrağı true", "-15-0", true, "-150", true);

console.log("");
console.log("### BİNLİK AYRAÇ SENARYOLARI (hiçbiri eksi içermiyor, invalidMinusUsage=false) ###");
checkSanitize("1.234,56 -> nokta binlik ayraç, virgül ondalık", "1.234,56", false, "1234,56", false);
checkSanitize("1.500 (tek nokta, 3 basamak sonrası) -> binlik ayraç, tam sayı", "1.500", false, "1500", false);
checkSanitize("1.234.567 (birden fazla nokta) -> hepsi binlik ayraç", "1.234.567", false, "1234567", false);
checkSanitize("1.234.567,89 -> binlik ayraçlar atılır, virgül kalır", "1.234.567,89", false, "1234567,89", false);
checkSanitize("negatif + binlik ayraç: -1.500 -> -1500 (geçerli eksi)", "-1.500", true, "-1500", false);
checkSanitize("negatif + binlik + ondalık: -1.234,56 -> -1234,56 (geçerli eksi)", "-1.234,56", true, "-1234,56", false);

console.log("");
console.log("### amountInputToCents (artık sanitizeAmountInput.value'yu girdi olarak alır) ###");
check("tam sayı", amountInputToCents("150"), 15000);
check("virgüllü", amountInputToCents("150,5"), 15050);
check("iki basamak ondalık", amountInputToCents("150,99"), 15099);
check("negatif", amountInputToCents("-150,50"), -15050);
check("boş -> null", amountInputToCents(""), null);
check("yalnız eksi -> null", amountInputToCents("-"), null);
check("sıfır", amountInputToCents("0"), 0);
check("virgülsüz negatif tam sayı", amountInputToCents("-99"), -9900);

console.log("");
console.log("### centsToAmountInput (round-trip) ###");
check("15050 kuruş -> 150,50", centsToAmountInput(15050), "150,50");
check("-15050 kuruş -> -150,50", centsToAmountInput(-15050), "-150,50");
check("0 kuruş -> 0,00", centsToAmountInput(0), "0,00");
check("tek basamaklı kuruş -> 0 ile doldurulur", centsToAmountInput(5), "0,05");

console.log("");
console.log("### round-trip tutarlılığı (giriş -> sanitize -> kuruş -> giriş) ###");
for (const raw of ["150,5", "0,01", "-42,9", "1000000,00"]) {
  const sanitized = sanitizeAmountInput(raw, true);
  const cents = amountInputToCents(sanitized.value);
  const back = cents === null ? null : centsToAmountInput(cents);
  console.log(`  ${raw} -> sanitize=${sanitized.value} -> cents=${cents} -> back=${back}`);
}

console.log("");
console.log("### formatCentsAsTl ###");
check("pozitif TL formatı", formatCentsAsTl(150050).includes("1.500,50"), true);
check("negatif TL formatı işareti içeriyor", formatCentsAsTl(-500).startsWith("-"), true);

console.log("");
console.log(`SONUÇ: ${pass} geçti, ${fail} başarısız`);
if (fail > 0) process.exit(1);
