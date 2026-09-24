import { test } from "node:test";
import assert from "node:assert/strict";
import { errorFingerprint, normalizeMessage, sanitizePath } from "./fingerprint";

test("normalizeMessage: değişken kısımlar maskelenir", () => {
  assert.equal(
    normalizeMessage("Hesap 0f8fad5b-d9cb-469f-a165-70867728950e bulunamadı (kod 42)"),
    "Hesap <id> bulunamadı (kod <n>)"
  );
});

test("sanitizePath: sorgu atılır, kimlik ve token maskelenir", () => {
  assert.equal(sanitizePath("/goals/0f8fad5b-d9cb-469f-a165-70867728950e?space=abc"), "/goals/[id]");
  assert.equal(sanitizePath("/invite/" + "a".repeat(64)), "/invite/[token]");
  assert.equal(sanitizePath(null), null);
});

test("errorFingerprint: aynı hata aynı, farklı hata farklı iz", () => {
  const a = errorFingerprint({ source: "client", message: "x is undefined at row 12", stack: "at f (app.js:10:5)", route: "/home" });
  const b = errorFingerprint({ source: "client", message: "x is undefined at row 99", stack: "at f (app.js:22:9)", route: "/home" });
  const c = errorFingerprint({ source: "client", message: "y is undefined", stack: "at f (app.js:10:5)", route: "/home" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 16);
});
