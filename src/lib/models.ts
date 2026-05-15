import { OutputMode } from "@/hooks/useEvodaoAgent";

export const MODELS = [
  "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.4",
  "deepseek/deepseek-v4-pro",
  "google/gemini-3.1-pro-preview",
  "moonshotai/kimi-k2.6",
  "z-ai/glm-5.1",
  "minimax/minimax-m2.7",
  "alibaba/qwen-3.6-plus",
] as const;

export type ModelId = (typeof MODELS)[number];

/** Image generation models */
export const IMAGE_MODELS = [
  "google/gemini-3-pro-image-preview",
  "google/gemini-3.1-flash-image-preview",
  "doubao/seedream-4.5",
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number];

/** LLM model display info — avoids i18n keySeparator dot-parsing issues */
export const MODEL_DISPLAY: Record<ModelId, { name: string; desc: string; descZh: string }> = {
  "anthropic/claude-opus-4.7":     { name: "Claude Opus 4.7",   desc: "Most capable Claude model",             descZh: "最强 Claude 模型" },
  "anthropic/claude-sonnet-4.5":   { name: "Claude Sonnet 4.5", desc: "Balanced performance & speed",           descZh: "均衡性能与速度" },
  "openai/gpt-5.4":                { name: "GPT-5.4",           desc: "OpenAI latest GPT model",                descZh: "OpenAI 最新 GPT 模型" },
  "deepseek/deepseek-v4-pro":      { name: "DeepSeek V4 Pro",   desc: "Coding, math & deep reasoning",          descZh: "编码、数学与深度推理" },
  "google/gemini-3.1-pro-preview": { name: "Gemini 3.1 Pro",    desc: "Google's frontier reasoning model",      descZh: "Google 前沿推理模型" },
  "moonshotai/kimi-k2.6":          { name: "Kimi K2.6",         desc: "Moonshot AI creative model",             descZh: "Moonshot 创意模型" },
  "z-ai/glm-5.1":                  { name: "GLM 5.1",           desc: "ZhipuAI fast & cost-effective",          descZh: "智谱 AI 快速低成本" },
  "minimax/minimax-m2.7":          { name: "MiniMax M2.7",      desc: "MiniMax general purpose",                descZh: "MiniMax 通用模型" },
  "alibaba/qwen-3.6-plus":         { name: "Qwen 3.6 Plus",     desc: "Alibaba advanced language model",        descZh: "阿里巴巴高级语言模型" },
};

/** Image model display info */
export const IMAGE_MODEL_DISPLAY: Record<ImageModelId, { name: string; desc: string; descZh: string }> = {
  "google/gemini-3-pro-image-preview":     { name: "Nano Banana Pro",    desc: "Highest quality, supports img2img",  descZh: "最高画质，支持图生图" },
  "google/gemini-3.1-flash-image-preview": { name: "Gemini Flash Image",  desc: "Balanced speed and quality",         descZh: "速度与质量均衡" },
  "doubao/seedream-4.5":                   { name: "Seedream 4.5",        desc: "ByteDance creative image model",     descZh: "字节跳动创意图像" },
};

/**
 * Estimated USD cost per 1,000,000 tokens (blended input+output average).
 * Used for display/estimation only — actual billing is via Enter AI All balance.
 */
export const MODEL_PRICING: Record<string, number> = {
  "anthropic/claude-opus-4.7":      30.0,
  "anthropic/claude-sonnet-4.5":     7.0,
  "openai/gpt-5.4":                 10.0,
  "deepseek/deepseek-v4-pro":        0.5,
  "google/gemini-3.1-pro-preview":   2.0,
  "moonshotai/kimi-k2.6":            0.5,
  "z-ai/glm-5.1":                    0.1,
  "minimax/minimax-m2.7":            0.5,
  "alibaba/qwen-3.6-plus":           0.3,
};

/**
 * Estimated USD cost per image generation (flat rate, not token-based).
 */
export const IMAGE_PRICING: Record<string, number> = {
  "google/gemini-3-pro-image-preview":     0.04,
  "google/gemini-3.1-flash-image-preview": 0.02,
  "doubao/seedream-4.5":                   0.015,
};

/** Calculate estimated USD cost for a run. */
export function estimateCostUsd(modelId: string, totalTokens: number): number {
  if (IMAGE_PRICING[modelId] !== undefined) {
    return IMAGE_PRICING[modelId]; // flat per image
  }
  const pricePerMillion = MODEL_PRICING[modelId] ?? 0;
  return (totalTokens / 1_000_000) * pricePerMillion;
}

/** Auto-selects the optimal model based on output mode */
export function getAutoModel(outputMode: OutputMode): ModelId {
  if (outputMode === "agent") return "deepseek/deepseek-v4-pro";
  return "z-ai/glm-5.1";
}
