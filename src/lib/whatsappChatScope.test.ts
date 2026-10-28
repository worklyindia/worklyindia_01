import { expect, test } from "bun:test";
import { messageBelongsToChat } from "./whatsappChatScope";

const owner = { id: "owner-chat", phone_number: "919999999999", company_id: null, audience: "customer_service", whatsapp_phone_number_id: "owner-number" };
const employee = { ...owner, id: "employee-chat", company_id: "company-a", audience: null, whatsapp_phone_number_id: "employee-number" };
const ownerMessage = { ...owner, conversation_id: owner.id, recipient_phone: owner.phone_number };
const employeeMessage = { ...employee, conversation_id: employee.id, recipient_phone: employee.phone_number };

test("owner chat rejects employee messages to the same recipient", () => {
  expect(messageBelongsToChat(employeeMessage, owner)).toBe(false);
  expect(messageBelongsToChat(ownerMessage, owner)).toBe(true);
});
test("employee chat rejects owner messages to the same recipient", () => {
  expect(messageBelongsToChat(ownerMessage, employee)).toBe(false);
  expect(messageBelongsToChat(employeeMessage, employee)).toBe(true);
});
test("same company chats from a different connected number stay separate", () => {
  expect(messageBelongsToChat({ ...employeeMessage, whatsapp_phone_number_id: "employee-number-2" }, employee)).toBe(false);
});
test("orphan messages require exact connected number and ownership", () => {
  expect(messageBelongsToChat({ ...ownerMessage, conversation_id: null }, owner)).toBe(true);
  expect(messageBelongsToChat({ ...ownerMessage, conversation_id: null, whatsapp_phone_number_id: null }, owner)).toBe(false);
  expect(messageBelongsToChat({ ...ownerMessage, audience: "employer" }, owner)).toBe(false);
});