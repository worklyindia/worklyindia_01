import { whatsappTemplateName, type WhatsAppAudience } from "@/lib/whatsappAudience";

export const SUPPORT_TEMPLATE_BODY = "Hello, this is Workly India support following up on your request. Please reply here if you still need help, and our team will assist you.";

export const supportTemplateName = (audience: WhatsAppAudience) => whatsappTemplateName("customer_support_chat", audience);

export const isSupportTemplate = (name: string, audience: WhatsAppAudience) => name === supportTemplateName(audience);

export const isAnySupportTemplate = (name: string) =>
  (["customer_service", "employer", "job_seeker"] as WhatsAppAudience[]).some((audience) => isSupportTemplate(name, audience));

export function prepareApprovedChatTemplates<T extends { name: string }>(templates: T[]): T[] {
  const supportTemplates = templates.filter((template) => isAnySupportTemplate(template.name));
  const chatStartTemplate = supportTemplates.find((template) => isSupportTemplate(template.name, "customer_service"))
    ?? supportTemplates.find((template) => isSupportTemplate(template.name, "employer"))
    ?? supportTemplates[0];
  const remaining = templates
    .filter((template) => !isAnySupportTemplate(template.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  return chatStartTemplate ? [chatStartTemplate, ...remaining] : remaining;
}