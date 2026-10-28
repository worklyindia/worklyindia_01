/** Public documentation only; never add authenticated portal tools here. */
export const documentCatalog = [
  ["/developers/whatsapp-docs", "whatsapp-docs", "WhatsApp Business API"],
  ["/developers/instagram-docs", "instagram-docs", "Instagram Inbox API"],
  ["/developers/facebook-docs", "facebook-docs", "Facebook Messenger API"],
  ["/developers/email-docs", "email-docs", "Email API"],
  ["/developers/job-docs", "job-docs", "Jobs API"],
  ["/developers/widget-docs", "widget-docs", "Widget Guide"],
  ["/developers/oauth", "oauth", "Developer OAuth"],
  ["/developers/partner-solutions", "partner-solutions", "Partner Solutions"],
  ["/api-docs/javascript-sdk", "javascript-sdk", "JavaScript SDK"],
  ["/api-docs/python-sdk", "python-sdk", "Python SDK"],
  ["/api-docs/curl-docs", "curl-docs", "cURL API Guide"],
  ["/api-docs/postman-docs", "postman-docs", "Postman API Guide"],
  ["/api-docs/how-it-works", "how-it-works", "How the API Works"],
  ["/api-docs/benefits", "benefits", "API Benefits"],
  ["/api-docs/faq", "faq", "API FAQ"],
  ["/api-docs/quick-start", "quick-start", "API Quick Start"],
  ["/api-docs/troubleshooting", "troubleshooting", "API Troubleshooting"],
  ["/api-docs/examples", "examples", "API Examples"],
  ["/api-docs/production-guide", "production-guide", "API Production Guide"],
] as const;

export function findPublicDocument(pathname: string) {
  return documentCatalog.find(([route]) => route === pathname.replace(/\/$/, ""));
}