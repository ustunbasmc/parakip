import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInputToCents, formatCentsAsCurrency, formatShare, sanitizeAmountInput } from "./amount";

test("sanitizeAmountInput: Türkçe binlik/ondalık ayırıcıları", () => {
  assert.equal(sanitizeAmountInput("1.234,56", false).value, "1234,56");
  assert.equal(sanitizeAmountInput("150.5", false).value, "150,5");
  assert.equal(sanitizeAmountInput("1.500", false).value, "1500");
  assert.equal(sanitizeAmountInput("1.234.567", false).value, "1234567");
  assert.equal(sanitizeAmountInput("12,345", false).value, "12,34");
  assert.equal(sanitizeAmountInput("₺ 40 000", false).value, "40000");
});

test("sanitizeAmountInput: eksi işareti kuralı görünür şekilde işaretlenir", () => {
  assert.deepEqual(sanitizeAmountInput("-150", true), { value: "-150", invalidMinusUsage: false });
  assert.deepEqual(sanitizeAmountInput("-150", false), { value: "150", invalidMinusUsage: true });
  assert.deepEqual(sanitizeAmountInput("15-0", true), { value: "150", invalidMinusUsage: true });
  assert.deepEqual(sanitizeAmountInput("--5", true), { value: "-5", invalidMinusUsage: true });
});

test("amountInputToCents: kuruşa çevirme", () => {
  assert.equal(amountInputToCents("1234,56"), 123456);
  assert.equal(amountInputToCents("40000"), 4000000);
  assert.equal(amountInputToCents("0,1"), 10);
  assert.equal(amountInputToCents("-150"), -15000);
  assert.equal(amountInputToCents(""), null);
  assert.equal(amountInputToCents("-"), null);
  assert.equal(amountInputToCents(","), null);
});

test("formatShare: küçük paylar %0 yerine <%1", () => {
  assert.equal(formatShare(55, 100), "%55");
  assert.equal(formatShare(3, 1000), "<%1");
  assert.equal(formatShare(0, 100), "%0");
  assert.equal(formatShare(5, 0), "%0");
});

test("formatCentsAsCurrency: TRY biçimi", () => {
  const out = formatCentsAsCurrency(123456, "TRY");
  assert.match(out, /1\.234,56/);
  assert.match(out, /₺/);
});
