import { OutputMode } from "@/hooks/useEvodaoAgent";

export const MODELS = [
  "openai/gpt-5.4-pro",
  "deepseek/deepseek-v4-pro",
  "z-ai/glm-5.1",
  "z-ai/glm-5",
  "moonshotai/kimi-k2.6",
  "minimax/minimax-m2.7",
] as const;

export type ModelId = (typeof MODELS)[number];

/** Auto-selects the optimal model based on output mode */
export function getAutoModel(outputMode: OutputMode): ModelId {
  if (outputMode === "agent") return "deepseek/deepseek-v4-pro";
  return "z-ai/glm-5.1";
}
