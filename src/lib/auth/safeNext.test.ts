import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safeNext";

test("safeNext: yalnızca uygulama içi göreli yollar", () => {
  assert.equal(safeNext("/invite/abc"), "/invite/abc");
  assert.equal(safeNext("/update-password"), "/update-password");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext("@evil.com"), "/");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/a\nb"), "/");
});
