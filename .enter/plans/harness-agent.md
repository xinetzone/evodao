# 修复模型下拉显示 / 无法选中 Gemini 问题

## 根因

`src/i18n/index.ts` 使用 i18next 默认 keySeparator = `.`。  
模型 ID 含 `.`（如 `gemini-3.1-pro-preview`），导致 `t("modelSelector.models.google/gemini-3.1-pro-preview.name")` 被拆成：
```
["modelSelector", "models", "google/gemini-3", "1-pro-preview", "name"]
```
查不到 → 返回 defaultValue（原始 slug）→ 触发按钮显示混乱，用户以为"选不了"。

受影响的模型（含 `.` 的 ID）：除 `deepseek/deepseek-v4-pro` 外全部都有此问题。

## 修复方案

将模型展示名 / 描述直接存入 `src/lib/models.ts`，完全绕开 i18n key 解析。

---

## 具体改动

### 1. `src/lib/models.ts`
新增两个 display record：

```typescript
export const MODEL_DISPLAY: Record<ModelId, { name: string; desc: string; descZh: string }> = {
  "anthropic/claude-opus-4.7":       { name: "Claude Opus 4.7",   desc: "Most capable Claude model",              descZh: "最强 Claude 模型" },
  "anthropic/claude-sonnet-4.5":     { name: "Claude Sonnet 4.5", desc: "Balanced performance & speed",            descZh: "均衡性能与速度" },
  "openai/gpt-5.4":                  { name: "GPT-5.4",           desc: "OpenAI latest GPT model",                 descZh: "OpenAI 最新 GPT 模型" },
  "deepseek/deepseek-v4-pro":        { name: "DeepSeek V4 Pro",   desc: "Coding, math & deep reasoning",           descZh: "编码、数学与深度推理" },
  "google/gemini-3.1-pro-preview":   { name: "Gemini 3.1 Pro",    desc: "Google's frontier reasoning model",       descZh: "Google 前沿推理模型" },
  "moonshotai/kimi-k2.6":            { name: "Kimi K2.6",         desc: "Moonshot AI creative model",              descZh: "Moonshot 创意模型" },
  "z-ai/glm-5.1":                    { name: "GLM 5.1",           desc: "ZhipuAI fast & cost-effective",           descZh: "智谱 AI 快速低成本" },
  "minimax/minimax-m2.7":            { name: "MiniMax M2.7",      desc: "MiniMax general purpose",                 descZh: "MiniMax 通用模型" },
  "alibaba/qwen-3.6-plus":           { name: "Qwen 3.6 Plus",     desc: "Alibaba advanced language model",         descZh: "阿里巴巴高级语言模型" },
};

export const IMAGE_MODEL_DISPLAY: Record<ImageModelId, { name: string; desc: string; descZh: string }> = {
  "openai/gpt-image-2":                    { name: "GPT Image 2",       desc: "DALL-E based image generation",   descZh: "DALL-E 图像生成" },
  "google/gemini-3.1-flash-image-preview": { name: "Gemini Flash Image", desc: "Balanced speed and quality",      descZh: "速度与质量均衡" },
  "doubao/seedream-4.5":                   { name: "Seedream 4.5",      desc: "ByteDance creative image model",  descZh: "字节跳动创意图像" },
};
```

### 2. `src/components/agent/ModelSelector.tsx`
- 导入 `MODEL_DISPLAY`
- 导入 `{ i18n }` from `react-i18next`（用 `i18n.language` 判断语言）
- 替换 `modelName()` 和 `modelDesc()` 函数：
  ```typescript
  const { i18n } = useTranslation();
  const modelName = (id: ModelId) => MODEL_DISPLAY[id]?.name ?? id.split("/")[1];
  const modelDesc = (id: ModelId) =>
    i18n.language === "zh" ? (MODEL_DISPLAY[id]?.descZh ?? "") : (MODEL_DISPLAY[id]?.desc ?? "");
  ```

### 3. `src/components/agent/GoalInput.tsx`
- 导入 `IMAGE_MODEL_DISPLAY`
- 替换图像模型名显示（2处 `t(`modelSelector.models.${imageModel}.name`)` 和 `t(`modelSelector.models.${m}.name`)`）：
  ```typescript
  IMAGE_MODEL_DISPLAY[imageModel]?.name ?? imageModel.split("/")[1]
  IMAGE_MODEL_DISPLAY[m]?.name ?? m.split("/")[1]
  ```

### 4. `src/pages/Index.tsx`
- 导入 `MODEL_DISPLAY, IMAGE_MODEL_DISPLAY`
- 替换页脚 `t(`modelSelector.models.${modelId}.name`)` 调用：
  ```typescript
  const modelId = ...;
  const isImage = lastRunMode === "image";
  return isImage
    ? (IMAGE_MODEL_DISPLAY[modelId as ImageModelId]?.name ?? modelId.split("/")[1])
    : (MODEL_DISPLAY[modelId as ModelId]?.name ?? modelId.split("/")[1]);
  ```
- 替换 `ImageOutput` 的 `modelName` prop 使用 `IMAGE_MODEL_DISPLAY`

---

## 不改动的文件

- `src/i18n/locales/en.json` / `zh.json` — 保留 modelSelector.models 下的 keys（虽然已不再被组件使用，但避免 JSON 结构变化引发其他问题）
- `src/i18n/index.ts` — 不修改 keySeparator（全局修改风险太大）

---

## 验证

1. 打开模型下拉 → 所有 9 个模型名称正确显示（"Claude Opus 4.7", "Gemini 3.1 Pro" 等）
2. 点击 Gemini 3.1 Pro → 触发按钮文字变为 "Gemini 3.1 Pro"，页脚随之更新
3. 切换语言到 EN → 描述切换为英文
4. 切换语言到 ZH → 描述切换为中文
5. 图像模式下图像模型名称正确（"GPT Image 2", "Gemini Flash Image", "Seedream 4.5"）
