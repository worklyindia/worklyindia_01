import { expect, test } from "bun:test";
import { getRoutePermission, isOwnerOnlyRoute, isPaymentEventsMenuVisible, ROUTE_PERMISSIONS } from "./permissionMapping";

test("API Subscription is included in the verified owner's permission map", () => {
  const ownerPermissions = Object.fromEntries(
    Object.keys(ROUTE_PERMISSIONS).map((route) => [route, true]),
  );
  expect(ownerPermissions["/owner-portal/api-pricing"] ?? false).toBe(true);
});

test("API Subscription retains the existing page's settings permission", () => {
  expect(getRoutePermission("/owner-portal/api-pricing")).toBe("settings.view");
});

test("Cloudflare storage retains the same owner-only access as Supabase storage", () => {
  expect(getRoutePermission("/owner-portal/cloudflare-storage")).toBe(getRoutePermission("/owner-portal/storage"));
  expect(isOwnerOnlyRoute("/owner-portal/cloudflare-storage")).toBe(true);
});
test("PayPal Payment Events requires the owner", () => {
  expect(isOwnerOnlyRoute("/owner-portal/paypal-payment-events")).toBe(true);
  expect(getRoutePermission("/owner-portal/paypal-payment-events")).toBe("settings.view");
});
test("Both payment event menus are hidden from non-owners", () => {
  for (const path of ["/owner-portal/payment-events", "/owner-portal/paypal-payment-events"]) {
    expect(isPaymentEventsMenuVisible(path, false)).toBe(false);
    expect(isPaymentEventsMenuVisible(path, true)).toBe(true);
  }
});
