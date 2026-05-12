/**
 * agentCore.ts — Module-level utilities for planning and executing agent tasks.
 * These are pure async functions (no React state) that can be called from any context.
 */
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { Task, OutputMode } from "@/hooks/useHarnessAgent";

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/harness-agent`;

type RawUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "Authentication failed.",
  rate_limit_error: "Too many requests. Please try again later.",
  invalid_request_error: "Invalid request.",
  overloaded_error: "Service is busy. Please try again later.",
  insufficient_credits: "AI credits have been exhausted.",
  permission_error: "AI capability is disabled.",
  api_error: "Service temporarily unavailable.",
};

function getUserErrorMessage(code: string, backendMessage: string): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[code] || "Service temporarily unavailable.";
}

export async function planTasksCore(
  goal: string,
  mode: OutputMode,
  model?: string
): Promise<Task[]> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ mode: "plan", goal, outputMode: mode, model }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Planning failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.tasks)) {
    throw new Error("Invalid task plan received");
  }
  return data.tasks;
}

export function executeTaskCore(
  goal: string,
  task: Task,
  context: string[],
  mode: OutputMode,
  model: string | undefined,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const localController = new AbortController();
    let settled = false;

    signal.addEventListener("abort", () => localController.abort(), { once: true });

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      localController.abort();
      fn();
    };

    fetchEventSource(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        mode: "execute",
        goal,
        task,
        context,
        outputMode: mode,
        model,
      }),
      signal: localController.signal,

      async onopen(response) {
        if (!response.ok) {
          const err = new Error(`Request failed: ${response.status}`);
          settle(() => reject(err));
          throw err;
        }
      },

      onmessage(event) {
        if (event.data === "[DONE]") { settle(() => resolve()); return; }
        if (!event.data) return;

        let data: Record<string, unknown>;
        try { data = JSON.parse(event.data); } catch { return; }

        const errObj = (data as { error?: { type?: string; message?: string } }).error;
        if (errObj) {
          const msg = getUserErrorMessage(errObj.type || "api_error", errObj.message || "");
          settle(() => reject(new Error(msg)));
          return;
        }

        const rawUsage = (data as { usage?: RawUsage }).usage;
        if (rawUsage && onUsage) {
          onUsage({
            promptTokens: rawUsage.prompt_tokens || 0,
            completionTokens: rawUsage.completion_tokens || 0,
            totalTokens: rawUsage.total_tokens || 0,
          });
        }

        const choice = (
          data as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }> }
        ).choices?.[0];
        if (!choice) return;
        if (choice.delta?.content) onChunk(choice.delta.content);
        if (choice.finish_reason) settle(() => resolve());
      },

      onerror(err) {
        if (settled) throw err;
        if (err instanceof Error && err.name === "AbortError") throw err;
        settle(() => reject(err));
        throw err;
      },
    });
  });
}
