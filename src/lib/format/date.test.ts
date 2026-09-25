import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMonthIso, parseMonthParam, shiftMonthIso, zonedIsoDate, zonedMidnight, zonedMonthIso, zonedMonthKey } from "./tz";
import { dayDiff, formatDueDateLabel, getPeriodRange, getPreviousPeriodRange } from "./date";
import { resolveHomePeriod } from "./homePeriod";

// 1 Ekim 2026 00:30 İstanbul = 30 Eylül 21:30 UTC. Sunucu UTC'de çalışırken
// eski kod bu anda hâlâ "Eylül"ü bu ay sayıyordu (düzeltilen hata).
const OCT_1_0030_IST = new Date("2026-09-30T21:30:00Z");

test("tz: İstanbul gece yarısı UTC+3", () => {
  assert.equal(zonedMidnight(2026, 10, 1).toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(zonedMidnight(2026, 13, 1).toISOString(), "2026-12-31T21:00:00.000Z"); // ay taşması
});

test("tz: ay başında doğru ay (sunucu saat diliminden bağımsız)", () => {
  assert.equal(zonedMonthIso(OCT_1_0030_IST), "2026-10-01");
  assert.equal(zonedIsoDate(OCT_1_0030_IST), "2026-10-01");
  assert.equal(zonedMonthKey(OCT_1_0030_IST), "2026-10");
});

test("tz: shiftMonthIso yıl geçişi", () => {
  assert.equal(shiftMonthIso("2026-12-01", 1), "2027-01-01");
  assert.equal(shiftMonthIso("2026-01-01", -1), "2025-12-01");
});

test("getPeriodRange: bu ay İstanbul sınırlarıyla", () => {
  assert.deepEqual(getPeriodRange("month", OCT_1_0030_IST), {
    start: "2026-09-30T21:00:00.000Z",
    end: "2026-10-31T21:00:00.000Z",
  });
});

test("getPeriodRange: hafta Pazartesi başlar", () => {
  // 24 Eylül 2026 Perşembe → hafta 21 Eylül Pazartesi
  const r = getPeriodRange("week", new Date("2026-09-24T10:00:00Z"));
  assert.equal(r.start, "2026-09-20T21:00:00.000Z");
  assert.equal(r.end, "2026-09-27T21:00:00.000Z");
});

test("getPreviousPeriodRange: geçen ay / dün / geçen yıl", () => {
  assert.deepEqual(getPreviousPeriodRange("month", OCT_1_0030_IST), {
    start: "2026-08-31T21:00:00.000Z",
    end: "2026-09-30T21:00:00.000Z",
  });
  assert.equal(getPreviousPeriodRange("today", OCT_1_0030_IST).start, "2026-09-29T21:00:00.000Z");
  assert.equal(getPreviousPeriodRange("year", OCT_1_0030_IST).start, "2024-12-31T21:00:00.000Z");
});

test("formatDueDateLabel: İstanbul'a göre bugün/yarın/gecikme", () => {
  assert.equal(formatDueDateLabel("2026-10-01", OCT_1_0030_IST), "Bugün");
  assert.equal(formatDueDateLabel("2026-10-02", OCT_1_0030_IST), "Yarın");
  assert.equal(formatDueDateLabel("2026-09-30", OCT_1_0030_IST), "Dün gecikti");
  assert.equal(formatDueDateLabel("2026-09-27", OCT_1_0030_IST), "4 gün gecikti");
  assert.equal(formatDueDateLabel("2026-10-05", OCT_1_0030_IST), "4 gün sonra");
});

test("dayDiff: takvim günü farkı", () => {
  assert.equal(dayDiff(new Date("2026-09-30T20:00:00Z"), OCT_1_0030_IST), 1); // 23:00 → ertesi gün 00:30
});

test("resolveHomePeriod: özel aralık ve önceki eşdeğer dönem", () => {
  const r = resolveHomePeriod("custom", "2026-09-01", "2026-09-10", OCT_1_0030_IST);
  assert.equal(r.period, "custom");
  assert.equal(r.range.start, "2026-08-31T21:00:00.000Z");
  assert.equal(r.range.end, "2026-09-10T21:00:00.000Z");
  assert.equal(r.previous.start, "2026-08-21T21:00:00.000Z"); // 10 gün öncesi
});

test("resolveHomePeriod: geçersiz aralık Bu ay'a düşer", () => {
  assert.equal(resolveHomePeriod("custom", "2026-09-10", "2026-09-01", OCT_1_0030_IST).period, "month");
  assert.equal(resolveHomePeriod("custom", "2026-02-30", "2026-03-01", OCT_1_0030_IST).period, "month");
  assert.equal(resolveHomePeriod("xyz", undefined, undefined, OCT_1_0030_IST).period, "month");
});

test("resolveHomePeriod: bugün, dün ve bu hafta (İstanbul, Pazartesi başlangıç)", () => {
  // 1 Ekim 2026 Perşembe, 00:30 İstanbul.
  const today = resolveHomePeriod("today", undefined, undefined, OCT_1_0030_IST);
  assert.equal(today.range.start, "2026-09-30T21:00:00.000Z");
  assert.equal(today.range.end, "2026-10-01T21:00:00.000Z");
  assert.equal(today.previous.start, "2026-09-29T21:00:00.000Z");
  const yesterday = resolveHomePeriod("yesterday", undefined, undefined, OCT_1_0030_IST);
  assert.equal(yesterday.range.start, "2026-09-29T21:00:00.000Z");
  assert.match(yesterday.label, /30 Eyl/);
  const week = resolveHomePeriod("week", undefined, undefined, OCT_1_0030_IST);
  assert.equal(week.range.start, "2026-09-27T21:00:00.000Z"); // Pazartesi 28 Eylül
  assert.equal(week.range.end, "2026-10-04T21:00:00.000Z");
  assert.equal(week.previous.start, "2026-09-20T21:00:00.000Z");
});

test("resolveHomePeriod: geçen ay etiketi", () => {
  const r = resolveHomePeriod("last_month", undefined, undefined, OCT_1_0030_IST);
  assert.equal(r.range.start, "2026-08-31T21:00:00.000Z");
  assert.match(r.label, /Eylül 2026/);
});

test("tz: ay parametresi ve etiketi", () => {
  assert.equal(parseMonthParam("2026-09"), "2026-09-01");
  assert.equal(parseMonthParam("2026-13"), null);
  assert.equal(parseMonthParam("abc"), null);
  assert.equal(parseMonthParam(undefined), null);
  assert.equal(formatMonthIso("2026-09-01"), "Eylül 2026");
  assert.equal(formatMonthIso("2027-01-01"), "Ocak 2027");
});
