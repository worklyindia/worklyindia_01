/**
 * Live "what is the AI actually doing right now" status.
 *
 * Every real work phase is persisted to `public.ai_task_status` (one row per
 * run, upserted on `run_id`) so the frontend can also follow the run through
 * Supabase Realtime — not only through the SSE stream. Raw tool arguments and
 * internal payloads live in `details` and are NEVER meant to be rendered to a
 * normal user; the UI only shows `message`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export type TaskPhase =
  | "started"
  | "analyzing"
  | "checking"
  | "verifying"
  | "finalizing"
  | "completed"
  | "failed";

export const PHASE_PROGRESS: Record<TaskPhase, number> = {
  started: 10,
  analyzing: 30,
  checking: 50,
  verifying: 70,
  finalizing: 90,
  completed: 100,
  failed: 100,
};

const VALID_PHASES = new Set<string>(Object.keys(PHASE_PROGRESS));

export function normalizePhase(phase?: string | null): TaskPhase {
  const p = String(phase || "").toLowerCase().trim();
  return (VALID_PHASES.has(p) ? p : "analyzing") as TaskPhase;
}

let client: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!client) {
    client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return client;
}

export interface TaskStatusUpdate {
  runId: string;
  userId?: string | null;
  phase: TaskPhase;
  message: string;
  progress?: number;
  lang?: string | null;
  details?: Record<string, unknown>;
  error?: string | null;
}

/**
 * Upsert the current status of a run. Never throws — status tracking must not
 * be able to break the actual AI reply.
 */
export async function persistTaskStatus(u: TaskStatusUpdate): Promise<void> {
  try {
    if (!u.runId) return;
    await admin()
      .from("ai_task_status")
      .upsert(
        {
          run_id: u.runId,
          user_id: u.userId || null,
          phase: u.phase,
          message: (u.message || "").slice(0, 200),
          progress: typeof u.progress === "number"
            ? Math.max(0, Math.min(100, Math.round(u.progress)))
            : PHASE_PROGRESS[u.phase],
          lang: u.lang || null,
          details: u.details ?? {},
          error: u.error ?? null,
          updated_at: new Date().toISOString(),
        } as never, // ai_task_status is not in the generated database types yet
        { onConflict: "run_id" },
      );
  } catch (e) {
    console.warn("[taskStatus] persist failed:", (e as Error)?.message);
  }
}
