import { expect, test } from "bun:test";
import { metaChatRequest, metaChatScope } from "./metaChatScope";
for (const action of ["status", "get_profile", "chat_contact", "chat_conversations", "chat_messages", "chat_send", "chat_react", "connect_url", "disconnect", "set_default"]) {
  test(`owner ${action} uses Customer Service, not employee accounts`, () => {
    expect(metaChatRequest({ action, account_id: "owner-account", audience: "employee" }, "support")).toEqual({ action, account_id: "owner-account", audience: "support" });
    expect(metaChatRequest({ action, account_id: "employee-account" })).toEqual({ action, account_id: "employee-account" });
  });
}
test("owner and employee caches remain separate even with matching account identifiers", () => {
  expect(metaChatScope("support")).toBe("support");
  expect(metaChatScope()).toBe("ai-connect");
  expect(metaChatScope("support")).not.toBe(metaChatScope());
});
