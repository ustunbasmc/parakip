import { test } from "node:test";
import assert from "node:assert/strict";
import { freeMonths, onboardingEntryPath, parsePlanKey, planPeriod, planSpaceType } from "./planParam";
import { parseSignupSource, signupHref } from "../marketing/attribution";

test("parsePlanKey yalnızca bilinen planları kabul eder", () => {
  assert.equal(parsePlanKey("home_yearly"), "home_yearly");
  assert.equal(parsePlanKey("business_monthly"), "business_monthly");
  assert.equal(parsePlanKey("enterprise"), null);
  assert.equal(parsePlanKey(null), null);
  assert.equal(planSpaceType("business_yearly"), "business");
  assert.equal(planPeriod("home_yearly"), "yearly");
});

test("freeMonths fiyatlardan hesaplanır", () => {
  assert.equal(freeMonths(99, 990), 2);
  assert.equal(freeMonths(249, 2490), 2);
  assert.equal(freeMonths(100, 1188), 0);
  assert.equal(freeMonths(0, 990), 0);
  assert.equal(freeMonths(100, 1100), 1);
});

test("onboardingEntryPath plan ve türü taşır", () => {
  assert.equal(onboardingEntryPath({ plan: "home_yearly" }), "/onboarding/space-type?plan=home_yearly");
  assert.equal(onboardingEntryPath({ type: "business" }), "/onboarding/space-type?type=business");
  assert.equal(onboardingEntryPath({}), null);
});

test("kayıt kaynağı güvenli okunur ve bağlantıya eklenir", () => {
  const src = parseSignupSource(new URLSearchParams("src=/ev-butcesi&utm_source=google&utm_campaign=<script>&utm_medium=cpc"));
  assert.deepEqual(src, { page: "/ev-butcesi", utm_source: "google", utm_medium: "cpc" });
  assert.equal(parseSignupSource({ src: "https://evil.com" }), null);
  assert.equal(
    signupHref({ plan: "home_yearly", page: "/", utm: { utm_source: "ig" } }),
    "/sign-up?plan=home_yearly&src=%2F&utm_source=ig"
  );
});
