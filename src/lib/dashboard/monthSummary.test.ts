import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthSummary } from "./monthSummary";

test("buildMonthSummary: değişim, tahmin, tasarruf oranı, kategoriler", () => {
  const s = buildMonthSummary({
    daysElapsed: 10,
    daysInMonth: 30,
    incomeCents: 5_000_000,
    expenseCents: 1_000_000,
    prevExpenseCents: 1_250_000,
    categories: [
      { categoryId: "a", categoryName: "Market", totalCents: 600_000 },
      { categoryId: "b", categoryName: "Yeme-İçme", totalCents: 400_000 },
    ],
    prevCategories: [
      { categoryId: "a", categoryName: "Market", totalCents: 900_000 },
      { categoryId: "b", categoryName: "Yeme-İçme", totalCents: 100_000 },
    ],
  });
  assert.equal(s.expenseChangePct, -20);
  assert.equal(s.dailyAvgCents, 100_000);
  assert.equal(s.projectedExpenseCents, 3_000_000);
  assert.equal(s.savingsRatePct, 80);
  assert.deepEqual(s.topCategory, { name: "Market", cents: 600_000 });
  assert.deepEqual(s.biggestIncrease, { name: "Yeme-İçme", deltaCents: 300_000 });
});

test("buildMonthSummary: karşılaştırma ve gelir yoksa null", () => {
  const s = buildMonthSummary({ daysElapsed: 1, daysInMonth: 31, incomeCents: 0, expenseCents: 0, prevExpenseCents: 0, categories: [], prevCategories: [] });
  assert.equal(s.expenseChangePct, null);
  assert.equal(s.savingsRatePct, null);
  assert.equal(s.topCategory, null);
  assert.equal(s.biggestIncrease, null);
});
