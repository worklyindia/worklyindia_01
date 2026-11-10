/** Every Customer Service Meta operation must carry the support audience. */
export function metaChatRequest(body: Record<string, unknown>, audience?: "support") {
  return { ...body, ...(audience ? { audience } : {}) };
}
export function metaChatScope(audience?: "support") { return audience ?? "ai-connect"; }
