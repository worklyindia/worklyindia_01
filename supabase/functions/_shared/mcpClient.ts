/**
 * Minimal MCP (Streamable HTTP / JSON-RPC) client for edge functions.
 *
 * Calls this project's own MCP server at /functions/v1/mcp, forwarding the
 * signed-in user's Supabase access token so RLS runs as that user.
 * Used by ai-career-chat to expose the MCP tools to the AI.
 */

const MCP_URL = `${
  (Deno.env.get("SUPABASE_URL") ?? "https://jubwzelupbntbetpajqb.supabase.co")
    .replace(/\/$/, "")
}/functions/v1/mcp`;

export const MCP_TOOL_PREFIX = "mcp_";

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

let rpcId = 0;

async function rpc(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<any> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      // Required by the MCP Streamable HTTP spec — without both types the
      // server answers 406.
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method,
      params,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`MCP ${method} failed (${res.status}): ${raw.slice(0, 300)}`);
  }

  // The server may answer as JSON or as a single SSE frame.
  let payload = raw.trim();
  if (payload.startsWith("event:") || payload.startsWith("data:")) {
    const dataLine = payload
      .split("\n")
      .find((l) => l.startsWith("data:"));
    payload = dataLine ? dataLine.slice(5).trim() : "{}";
  }

  const json = JSON.parse(payload);
  if (json.error) {
    throw new Error(`MCP ${method} error: ${json.error.message ?? "unknown"}`);
  }
  return json.result;
}

/** List the tools the MCP server exposes to this user (cached per token). */
const listCache = new Map<string, { at: number; tools: McpToolDescriptor[] }>();

export async function listMcpTools(token: string): Promise<McpToolDescriptor[]> {
  const key = token.slice(-24);
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.tools;

  const result = await rpc(token, "tools/list");
  const tools: McpToolDescriptor[] = Array.isArray(result?.tools)
    ? result.tools
    : [];
  listCache.set(key, { at: Date.now(), tools });
  return tools;
}

/** OpenAI-style function descriptors for the AI, prefixed with `mcp_`. */
export async function getMcpToolDefinitions(token: string) {
  const tools = await listMcpTools(token);
  return tools.map((t) => ({
    type: "function",
    function: {
      name: `${MCP_TOOL_PREFIX}${t.name}`,
      description:
        `[Workly MCP] ${t.description ?? t.name} Use this for live Workly job, ` +
        `job-detail, application or profile data straight from the MCP server.`,
      parameters: (t.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    },
  }));
}

export function isMcpToolName(name: string): boolean {
  return typeof name === "string" && name.startsWith(MCP_TOOL_PREFIX);
}

/** Execute an `mcp_*` tool and return a plain JSON result for the AI. */
export async function callMcpTool(
  token: string,
  prefixedName: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const name = prefixedName.startsWith(MCP_TOOL_PREFIX)
    ? prefixedName.slice(MCP_TOOL_PREFIX.length)
    : prefixedName;

  try {
    const result = await rpc(token, "tools/call", {
      name,
      arguments: args ?? {},
    });

    const text = Array.isArray(result?.content)
      ? result.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => c.text)
        .join("\n")
      : "";

    if (result?.isError) {
      return { error: text || `MCP tool ${name} failed` };
    }

    return {
      source: "workly-mcp",
      tool: name,
      ...(result?.structuredContent ?? {}),
      ...(text ? { text } : {}),
    };
  } catch (e) {
    return { error: `MCP tool ${name} failed: ${String((e as Error)?.message ?? e)}` };
  }
}
