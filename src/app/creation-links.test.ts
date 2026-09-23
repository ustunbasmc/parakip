import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Oluşturma sayfaları (/accounts/new, /budgets/new, /debts/new,
 * /debts/recurring/new, /investments/buy, /investments/sell) `book_id`
 * parametresi OLMADAN açılamaz ve kullanıcıyı sessizce listeye geri
 * gönderir. Bu test, kaynak koddaki bu sayfalara giden TÜM bağlantıların
 * book_id taşıdığını doğrular (bütçe "boş dönüyor" hatasının tekrarını
 * önlemek için).
 */
const TARGET = /\/(accounts\/new|budgets\/new|debts\/new|debts\/recurring\/new|investments\/buy|investments\/sell)\?[^"'`\s)]*/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

test("oluşturma sayfalarına giden bağlantılar book_id taşır", () => {
  const offenders: string[] = [];
  for (const file of walk(join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(TARGET)) {
      if (!match[0].includes("book_id=")) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `book_id eksik bağlantılar:\n${offenders.join("\n")}`);
});
