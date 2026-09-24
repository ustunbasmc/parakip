import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationHref } from "./notifications";

test("notificationHref: admin duyurusu yalnızca uygulama içi yola gider", () => {
  const base = { entityType: "admin_broadcast", entityId: "b1", spaceId: null };
  assert.equal(notificationHref({ ...base, link: "/net-worth" }, null), "/net-worth");
  assert.equal(notificationHref({ ...base, link: "//evil.com" }, null), null);
  assert.equal(notificationHref({ ...base, link: "https://evil.com" }, null), null);
  assert.equal(notificationHref({ ...base, link: null }, null), null);
});

test("notificationHref: sahiplik devri alanın ana sayfasına gider", () => {
  assert.equal(notificationHref({ entityType: "space", entityId: "s1", spaceId: "s1" }, null), "/home?space=s1");
});
