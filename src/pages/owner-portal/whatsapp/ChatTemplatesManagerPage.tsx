import { useNavigate } from "react-router-dom";
import { goBack } from "@/lib/goBack";
import WhatsAppTemplateStudio, { type TemplateStudioApi } from "@/components/whatsapp/WhatsAppTemplateStudio";
import { CHAT_AUDIENCE, waInvoke } from "@/lib/whatsappAudience";

async function call(body: Record<string, unknown>) {
  const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { audience: CHAT_AUDIENCE, ...body } });
  if (error || data?.success === false) throw new Error(data?.error || error?.message || "Request failed");
  return data;
}

const api: TemplateStudioApi = {
  key: "owner-customer-service",
  list: async () => (await call({ action: "get_templates" })).data || [],
  save: async (mode, payload) => {
    await call({ action: mode === "edit" ? "edit_template" : "create_template", ...payload });
    await call({ action: "sync_templates" }).catch(() => undefined);
  },
  remove: async (name) => { await call({ action: "delete_template", template_name: name }); },
  upload: async (dataUrl) => (await call({ action: "upload_template_media", data_url: dataUrl })).handle,
};

export default function ChatTemplatesManagerPage() {
  const navigate = useNavigate();
  return <WhatsAppTemplateStudio api={api} title="Templates" onBack={() => goBack(navigate, "/owner-portal/whatsapp/chat")} />;
}
