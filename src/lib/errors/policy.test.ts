import { test } from "node:test";
import assert from "node:assert/strict";
import { isClientDisconnect, shouldRecordErrors } from "./policy";

test("yalnızca Vercel'deki production sürümü hata kaydeder", () => {
  assert.equal(shouldRecordErrors({ VERCEL: "1", NODE_ENV: "production" } as NodeJS.ProcessEnv), true);
  assert.equal(shouldRecordErrors({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(shouldRecordErrors({ VERCEL: "1", NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
});

test("istemcinin bağlantıyı kapatması hata sayılmaz", () => {
  assert.equal(isClientDisconnect(new Error("The destination stream closed early.")), true);
  assert.equal(isClientDisconnect({ name: "ResponseAborted", message: "" }), true);
  assert.equal(isClientDisconnect({ message: "read ECONNRESET" }), true);
  assert.equal(isClientDisconnect({ message: "x", code: "EPIPE" }), true);
  assert.equal(isClientDisconnect(new Error("Cannot read properties of undefined")), false);
  assert.equal(isClientDisconnect(new Error("The operation was aborted due to timeout")), false);
  assert.equal(isClientDisconnect(null), false);
});
