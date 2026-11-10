import { useNavigate } from "react-router-dom";
import { goBack } from "@/lib/goBack";
import WhatsAppTemplateStudio, { type TemplateStudioApi } from "@/components/whatsapp/WhatsAppTemplateStudio";
import { employerWhatsAppAction } from "@/components/employer/whatsapp/useEmployerWhatsApp";

const api: TemplateStudioApi = {
  key: "employer-company",
  list: async () => (await employerWhatsAppAction({ action: "list_all_templates" })).data || [],
  save: async (mode, payload) => { await employerWhatsAppAction({ action: mode === "edit" ? "edit_template" : "create_template", ...payload }); },
  remove: async (name) => { await employerWhatsAppAction({ action: "delete_template", template_name: name }); },
  upload: async (dataUrl) => (await employerWhatsAppAction({ action: "upload_template_media", data_url: dataUrl })).handle,
};

export default function EmployerWhatsAppTemplatesPage() {
  const navigate = useNavigate();
  return <WhatsAppTemplateStudio api={api} title="Templates" onBack={() => goBack(navigate, "/employer/workly-chat")} />;
}
