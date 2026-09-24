import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyNeededCents } from "./goals";

const today = new Date(Date.UTC(2026, 8, 24)); // 24 Eylül 2026

test("monthlyNeededCents: kalan tutar / kalan ay", () => {
  // 24 Aralık hedef, 3 ay kaldı, 30.000 ₺ - 6.000 ₺ = 24.000 ₺ → 8.000 ₺/ay
  assert.equal(monthlyNeededCents({ targetCents: 3_000_000, savedCents: 600_000, targetDate: "2026-12-24" }, today), 800_000);
  // Aynı ay içinde hedef → 1 ay sayılır
  assert.equal(monthlyNeededCents({ targetCents: 100_000, savedCents: 0, targetDate: "2026-09-30" }, today), 100_000);
  // Yuvarlama yukarı
  assert.equal(monthlyNeededCents({ targetCents: 1_000, savedCents: 0, targetDate: "2026-12-01" }, today), 334);
});

test("monthlyNeededCents: tarih yok / hedefe ulaşıldı / tarih geçti → null", () => {
  assert.equal(monthlyNeededCents({ targetCents: 1_000, savedCents: 0, targetDate: null }, today), null);
  assert.equal(monthlyNeededCents({ targetCents: 1_000, savedCents: 1_000, targetDate: "2026-12-01" }, today), null);
  assert.equal(monthlyNeededCents({ targetCents: 1_000, savedCents: 0, targetDate: "2026-09-01" }, today), null);
});
