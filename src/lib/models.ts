import { OutputMode } from "@/hooks/useEvodaoAgent";

export const MODELS = [
  "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.4",
  "deepseek/deepseek-v4-pro",
  "google/gemini-3.1-pro-preview",
  "moonshotai/kimi-k2.6",
  "z-ai/glm-5.1",
  "z-ai/glm-5",
  "minimax/minimax-m2.7",
  "alibaba/qwen-3.6-plus",
] as const;

export type ModelId = (typeof MODELS)[number];

/** Image generation models */
export const IMAGE_MODELS = [
  "openai/gpt-image-2",
  "google/gemini-3.1-flash-image-preview",
  "doubao/seedream-4.5",
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number];

/** Auto-selects the optimal model based on output mode */
export function getAutoModel(outputMode: OutputMode): ModelId {
  if (outputMode === "agent") return "deepseek/deepseek-v4-pro";
  return "z-ai/glm-5.1";
}
