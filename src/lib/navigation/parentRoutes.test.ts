import { test } from "node:test";
import assert from "node:assert/strict";
import { getParentHref, withSpaceParam } from "./parentRoutes";

test("getParentHref: hiyerarşik geri rotaları", () => {
  const cases: [string, string][] = [
    ["/accounts/abc", "/accounts"],
    ["/debts/abc", "/debts"],
    ["/debts/recurring", "/debts"],
    ["/debts/recurring/new", "/debts/recurring"],
    ["/budgets/abc", "/budgets"],
    ["/goals/abc", "/goals"],
    ["/goals/new", "/goals"],
    ["/transactions/recurring", "/transactions"],
    ["/transactions/recurring/new", "/transactions/recurring"],
    ["/transactions/abc", "/transactions"],
    ["/investments/abc", "/investments"],
    ["/help/parakip-nedir", "/help"],
    ["/help", "/home"],
    ["/support/tickets/abc", "/support/tickets"],
    ["/settings/categories", "/settings"],
    ["/admin/support/abc", "/admin/support"],
    ["/admin/help/abc", "/admin/help"],
    ["/admin/help/categories", "/admin/help"],
    ["/settings/notifications", "/settings"],
    ["/admin/spaces/abc", "/admin/spaces"],
    ["/admin/subscriptions", "/admin"],
    ["/admin/audit", "/admin"],
  ];
  for (const [path, parent] of cases) assert.equal(getParentHref(path), parent, path);
});

test("withSpaceParam: yalnızca alan bazlı ebeveynlerde space taşınır", () => {
  assert.equal(withSpaceParam("/accounts", "?space=s1&x=1"), "/accounts?space=s1");
  assert.equal(withSpaceParam("/help", "?space=s1"), "/help");
  assert.equal(withSpaceParam("/accounts", ""), "/accounts");
  assert.equal(withSpaceParam("/net-worth", "?space=s1"), "/net-worth?space=s1");
});
