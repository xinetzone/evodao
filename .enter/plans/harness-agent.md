# 全面复盘：逻辑一致性修复 + 所有模型可用

## 问题清单

经过全代码审查，发现 4 个逻辑不一致问题：

---

### Bug 1 (严重) — `applyEvolution` 丢失用户选择的模型
**位置**: `src/hooks/useEvodaoAgent.ts` → `applyEvolution`

用户选了 Claude Opus，执行完毕后点「进化」，点「应用进化」时调用：
```typescript
await runAgent(r.evolvedGoal, outputModeRef.current, onComplete, evolutionCtx);
// 没传 model！
```
→ 进化轮次永远退回 GLM 5.1 (UTILITY_MODEL)，完全忽略用户选择。

**修复**: 在 `runAgent` 里把 model 写入 `currentModelRef`，`applyEvolution` 里用 `currentModelRef.current` 传给 `runAgent`。同时暴露 `currentModel` state 供 UI 使用。

---

### Bug 2 (中) — QA 模式 `finalizeUsage` 永远不触发
**位置**: `src/pages/Index.tsx` 的 `useEffect` 监听 `status === "done"`

QA 执行完后 status 变化链：`idle → executing → idle`，从不经过 "done"。
→ QA 的 `usage_logs` 行只有初始记录，token 数永远为 0。

**修复**: 在 finalize useEffect 里增加 QA 条件：
`prevStatus === "executing" && status === "idle" && outputMode === "qa"`

---

### Bug 3 (轻) — 页脚模型名显示不一致
**位置**: `src/pages/Index.tsx` 中的 `setActiveModel` 调用

- 图像模式: `t(`modelSelector.models.${model}.name`)` → 用 i18n 名称 ✓  
- LLM 模式: `model.split("/")[1]` → 原始 slug (如 "glm-5.1", "gpt-5.4")  
  进化执行后 `activeModel` 完全不更新

**修复**: 移除 `activeModel` 本地 state，改为从 `currentModel` + i18n 派生显示名称。

---

### Bug 4 (轻) — 图像模型翻译名称错误
**位置**: `src/i18n/locales/en.json` 和 `zh.json`

`google/gemini-3.1-flash-image-preview` 的 name 是 "Nano Banana 2"（占位符/残留错误）。  

**修复**: 改为 "Gemini Flash Image" / "Gemini Flash 图像"。

---

## 修改文件

### 1. `src/hooks/useEvodaoAgent.ts`

**变更**:
- 导入 `getAutoModel` from `@/lib/models`
- 新增 `const [currentModel, setCurrentModel] = useState<string>(UTILITY_MODEL)`
- 新增 `const currentModelRef = useRef<string>(UTILITY_MODEL)` + 同步 useEffect
- `runAgent` 函数开头：设置 `currentModelRef.current` 和 `setCurrentModel`
- `applyEvolution`：改为 `await runAgent(..., currentModelRef.current)`
- 暴露 `currentModel` 在 return 对象里

### 2. `src/pages/Index.tsx`

**变更**:
- 从 `useEvodaoAgent` 解构中增加 `currentModel`
- 删除 `const [activeModel, setActiveModel] = useState("GLM 5.1")`
- 删除 `const [activeImageModelId, ...]` 中对应的 `setActiveModel(...)` 调用（两处 setActiveModel 调用）
- 删除 `activeImageModelId` 的 setActiveModel 调用 → 只保留 `setActiveImageModelId`
- 新增计算：
  ```typescript
  const activeModelDisplay = lastRunMode === "image"
    ? t(`modelSelector.models.${activeImageModelId}.name`, { defaultValue: activeImageModelId.split("/")[1] })
    : t(`modelSelector.models.${currentModel}.name`, { defaultValue: currentModel.split("/")[1] });
  ```
- JSX 里把所有 `{activeModel}` 改为 `{activeModelDisplay}`
- 修复 QA finalize useEffect，增加 QA 完成判断

### 3. `src/i18n/locales/en.json`
- `google/gemini-3.1-flash-image-preview` name: `"Nano Banana 2"` → `"Gemini Flash Image"`

### 4. `src/i18n/locales/zh.json`
- `google/gemini-3.1-flash-image-preview` name: `"Nano Banana 2"` → `"Gemini Flash 图像"`

---

## 模型路径验证

所有 9 个 LLM 模型在 harness-agent edge function 中的处理路径：

| 模型 | isClaudeModel | 协议 | 流式端点 | 非流式端点 |
|------|--------------|------|---------|---------|
| anthropic/claude-opus-4.7 | ✓ | Anthropic Messages | API_BASE_MESSAGES | API_BASE_MESSAGES |
| anthropic/claude-sonnet-4.5 | ✓ | Anthropic Messages | API_BASE_MESSAGES | API_BASE_MESSAGES |
| openai/gpt-5.4 | ✗ | OpenAI Chat | API_BASE | API_BASE |
| deepseek/deepseek-v4-pro | ✗ | OpenAI Chat | API_BASE | API_BASE |
| google/gemini-3.1-pro-preview | ✗ | OpenAI Chat | API_BASE | API_BASE |
| moonshotai/kimi-k2.6 | ✗ | OpenAI Chat | API_BASE | API_BASE |
| z-ai/glm-5.1 | ✗ | OpenAI Chat | API_BASE | API_BASE |
| minimax/minimax-m2.7 | ✗ | OpenAI Chat | API_BASE | API_BASE |
| alibaba/qwen-3.6-plus | ✗ | OpenAI Chat | API_BASE | API_BASE |

3 个图像模型走独立的 `ai-image-submit` edge function，不受以上影响。

Edge function 本身逻辑完整，无需改动。

---

## 验证

1. 选 Claude Opus → 运行 → Evolve → Apply → 确认进化轮依然用 Claude（页脚显示 "Claude Opus 4.7"）
2. QA 模式对话后，检查 Supabase usage_logs 表，total_tokens 应有实际值
3. 页脚模型名显示"Claude Opus 4.7"而非"claude-opus-4.7"
4. 图像模式选 Gemini Flash 显示"Gemini Flash Image"而非"Nano Banana 2"
