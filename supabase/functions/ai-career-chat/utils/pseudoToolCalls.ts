// Balanced-paren detection / removal / extraction of hallucinated tool calls
// that some models write as PLAIN TEXT instead of emitting a real tool_call.
//
// Examples seen in production:
//   send_progress_message("Ek sec... 🔍")
//   tools.web_search({"query": "workly india", "num": 5})
//   print(default_api.search_youtube(query='Manoj Dey', order='date'))
//   x = search_jobs({"role":"driver"})
//
// Regex with non-greedy `\(...\)` breaks on nested parens/braces and leaves
// residue like `") ")`. This scanner balances quotes and brackets properly.

export interface PseudoToolCall {
  name: string;
  args: Record<string, unknown>;
  raw: string;
}

function findMatchingParen(text: string, openIdx: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function buildCallRegex(toolNames: string[]): RegExp {
  const names = toolNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // optional `var = `, optional `print(`, optional `tools.`/`default_api.`
  return new RegExp(
    `(?:\\b[a-z_][a-z0-9_]*\\s*=\\s*)?(?:\\bprint\\s*\\(\\s*)?(?:\\btools?\\.|\\bdefault_api\\.)?\\b(${names})\\s*\\(`,
    "gi",
  );
}

function parseArgs(inner: string): Record<string, unknown> {
  const trimmed = inner.trim();
  if (!trimmed) return {};
  // JSON object form
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch { /* fall through */ }
    try {
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch { /* fall through */ }
  }
  // kwargs form: key='value', key="value", key=123, key=true
  const out: Record<string, unknown> = {};
  const kw =
    /([a-z_][a-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,()]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = kw.exec(trimmed)) !== null) {
    let v: unknown = m[2].trim();
    const s = v as string;
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      v = s.slice(1, -1);
    } else if (/^-?\d+(\.\d+)?$/.test(s)) v = Number(s);
    else if (s === "true" || s === "false") v = s === "true";
    out[m[1]] = v;
  }
  if (Object.keys(out).length > 0) return out;
  // single positional string arg → treat as query/message
  const pos = trimmed.replace(/^['"`]|['"`]$/g, "");
  return pos ? { query: pos, message: pos, text: pos } : {};
}

interface Found extends PseudoToolCall {
  start: number;
  end: number;
}

function findAll(text: string, toolNames: string[]): Found[] {
  const re = buildCallRegex(toolNames);
  const found: Found[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const close = findMatchingParen(text, openIdx);
    if (close === -1) {
      // Unterminated call — drop everything from here to end of line.
      const eol = text.indexOf("\n", m.index);
      found.push({
        name: m[1],
        args: {},
        raw: text.slice(m.index),
        start: m.index,
        end: eol === -1 ? text.length : eol,
      });
      break;
    }
    let end = close + 1;
    // swallow the closing paren of a wrapping print( ... )
    if (/\bprint\s*\(\s*$/i.test(m[0])) {
      const after = text.slice(end).match(/^\s*\)/);
      if (after) end += after[0].length;
    }
    // swallow trailing `print(var)` right after an assignment form
    const trailing = text.slice(end).match(/^\s*print\s*\(\s*[a-z0-9_]+\s*\)/i);
    if (trailing) end += trailing[0].length;

    found.push({
      name: m[1],
      args: parseArgs(text.slice(openIdx + 1, close)),
      raw: text.slice(m.index, end),
      start: m.index,
      end,
    });
    re.lastIndex = end;
  }
  return found;
}

export function extractPseudoToolCalls(
  text: string,
  toolNames: string[],
): PseudoToolCall[] {
  if (!text) return [];
  return findAll(text, toolNames).map(({ name, args, raw }) => ({
    name,
    args,
    raw,
  }));
}

export function stripPseudoToolCalls(
  text: string,
  toolNames: string[],
): string {
  if (!text) return text;
  const found = findAll(text, toolNames);
  if (found.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const f of found) {
    out += text.slice(cursor, f.start);
    cursor = f.end;
  }
  out += text.slice(cursor);
  return out;
}

/**
 * Some models write the tool NAME with no parentheses at all, e.g.
 *   `send_progress_message Manoj Dey ke subscribers check kar rahi hoon... 📈`
 * The balanced-paren scanner never sees those, so the raw identifier reached
 * the chat bubble. Remove any bare tool-name token that isn't followed by `(`.
 */
function bareToolNameRegex(toolNames: string[]): RegExp {
  const names = toolNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(
    `(?:^|\\n)?[ \\t]*(?:\\btools?\\.|\\bdefault_api\\.)?\\b(?:${names})\\b\\s*(?![\\s\\S]{0,2}\\()[:\\-–—>]*[ \\t]*`,
    "gi",
  );
}

export function hasBareToolName(text: string, toolNames: string[]): boolean {
  if (!text) return false;
  return bareToolNameRegex(toolNames).test(text);
}

export function stripBareToolNames(text: string, toolNames: string[]): string {
  if (!text) return text;
  return text.replace(bareToolNameRegex(toolNames), " ");
}

// Residue cleanup for orphan quotes/parens/commas left after removal.
// This also catches fragments that arrive in a LATER stream chunk than the
// call itself (e.g. the tail `") ")` of a `send_progress_message("... ✨")`
// whose head was already stripped) — those used to reach the chat bubble.
export function cleanupResidue(text: string): string {
  if (!text) return text;
  return text
    // empty JSX/XML-ish fragments left by a stripped tool block: `<> </>`
    .replace(/<\s*\/?\s*>/g, "")
    // lines made only of punctuation / quotes / emoji fragments
    .replace(/(?:^|\n)[ \t]*["'`)\]\},;:.]+[ \t]*(?=\n|$)/g, "\n")
    // orphan `") "` style sequences between words
    .replace(/["'`]\s*\)\s*["'`]?/g, " ")
    // leading orphan closers, incl. an emoji glued to them: `✨") ")`
    .replace(/^[\s]*(?:["'`]\s*\)|\)\s*["'`]|["'`,;]|\))+[\s]*/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/**
 * True when the text is nothing but leftover punctuation / quotes / brackets /
 * emoji — i.e. it carries no real words or numbers. Such a chunk must never be
 * shown as a chat message; the caller should rebuild a real answer instead.
 */
export function isResidueOnly(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text || "");
}


/**
 * Some models paste the RAW tool payload into the chat bubble before their
 * human answer, e.g.
 *   the_youtube_channel_data = { "channel_name": "Gohil Khedut", ... }
 *   "traffic_sources": {"SHORTS": 1122, "YT_CHANNEL": 423, ...}
 * The user must never see that. This strips balanced JSON-ish blobs (with or
 * without a `name =` prefix) and any leftover key/value fragment lines.
 */
function countJsonKeys(block: string): number {
  const m = block.match(/["'][A-Za-z0-9_ .-]+["']\s*:/g);
  return m ? m.length : 0;
}

export function stripRawDataDumps(text: string): string {
  if (!text) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{" || ch === "[") {
      const close = findMatchingParen(text, i);
      if (close === -1 && countJsonKeys(text.slice(i)) >= 2) {
        // Unterminated dump (streaming, or truncated) — drop the rest.
        break;
      }
      if (close !== -1) {
        const block = text.slice(i, close + 1);
        if (countJsonKeys(block) >= 3) {
          // also drop a preceding `some_var = ` / `some_var: ` assignment
          out = out.replace(
            /(?:^|\n)[ \t]*(?:const |let |var )?[A-Za-z_][A-Za-z0-9_]*\s*[=:]\s*$/,
            "\n",
          );
          i = close + 1;
          // swallow a trailing comma/semicolon
          while (i < text.length && /[,;]/.test(text[i])) i++;
          continue;
        }
      }
    }
    out += ch;
    i++;
  }

  // Leftover fragments of a truncated dump: lines carrying 2+ "key": value
  // pairs and no real sentence.
  out = out
    .split("\n")
    .filter((line) => {
      const keys = countJsonKeys(line);
      if (keys < 2) return true;
      // keep lines that read like prose despite quotes
      return /[.!?][ \t]*$/.test(line.trim()) && keys < 4;
    })
    .join("\n");

  return out
    .replace(/(?:^|\n)[ \t]*[,;}\]]+[ \t]*(?=\n|$)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
