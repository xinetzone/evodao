# 全面复盘 — 逻辑与内容一致性修复

## Context

对项目进行系统复盘，找出并修复所有逻辑不一致、内容混语、i18n 缺失及 AGENTS.md 合规问题。

---

## 问题清单

### 1. i18n 缺失键 / 硬编码字符串（6 处）

| 文件 | 问题 | 类型 |
|------|------|------|
| `Index.tsx:345` | `t("common.useAsPrompt", ...)` — 键未在 locales 中定义，用 `defaultValue` 变通 | 缺失键 |
| `GoalInput.tsx:467` | `title="上传附件（图片、PDF、TXT…）"` — 硬编码中文 | 硬编码 |
| `GoalInput.tsx:471` | `"附件"` label — 硬编码中文 | 硬编码 |
| `GoalInput.tsx:406-407` | `title="移除"` — 硬编码中文 | 硬编码 |
| `GoalInput.tsx:549` | `"处理中…"` — 硬编码中文（运行按钮加载态） | 硬编码 |
| `EvolutionPanel.tsx:103` | `"analyzing..."` — 硬编码英文 | 硬编码 |

### 2. AgentHeader 硬编码 UI 文本（2 处）

| 文件 | 问题 |
|------|------|
| `AgentHeader.tsx:152,155,237` | `"Platforms"` 按钮文本未经 i18n |
| `AgentHeader.tsx:152` | `title="Agent World Platforms"` 未经 i18n |

### 3. Edge Function 代码不一致（1 处）

`supabase/functions/harness-agent/index.ts`:
- 主 body 解构（第 278-290 行）未包含 `memoryContext`；
  该字段在 `plan` 分支内再次单独解构（第 537 行）。
- 修复：在主解构中加入 `memoryContext`，删除重复解构。

### 4. AGENTS.md 合规性 — PlatformPanel 敏感数据（1 处）

`src/components/agent/PlatformPanel.tsx`:
- ACCOUNTS 数组硬编码了 4 个完整 Agent World API Key（高风险，对应 AGENTS.md 2.1 "API 密钥与 Token"）。
- 该文件是功能性操作面板（用户复制自己的 key），属于可豁免情形。
- 修复：按 AGENTS.md 2.3c 流程，在文件顶部添加 `DESENSITIZATION_EXEMPTION` 注释，说明豁免原因，并在变更日志表格（AGENTS.md）中记录。

---

## 修复方案

### Step 1 — 补充 i18n 键

在 `en.json` / `zh.json` 中新增以下键：

```jsonc
// en.json 新增
"common": {
  "useAsPrompt": "Use as Prompt"
},
"goalInput": {
  // 已有键...
  "attachTitle": "Attach file (image, PDF, TXT…)",
  "attachLabel": "Attach",
  "remove": "Remove",
  "processing": "Processing…"
},
"evolution": {
  // 已有键...
  "analyzing": "analyzing..."
},
"header": {
  // 已有键...
  "platforms": "Platforms",
  "platformsTitle": "Agent World Platforms"
}
```

```jsonc
// zh.json 新增
"common": {
  "useAsPrompt": "作为提示词"
},
"goalInput": {
  // ...
  "attachTitle": "上传附件（图片、PDF、TXT…）",
  "attachLabel": "附件",
  "remove": "移除",
  "processing": "处理中…"
},
"evolution": {
  // ...
  "analyzing": "分析中..."
},
"header": {
  // ...
  "platforms": "平台",
  "platformsTitle": "Agent World 平台"
}
```

### Step 2 — 修复 GoalInput.tsx 硬编码字符串

- `title="上传附件..."` → `title={t("goalInput.attachTitle")}`
- `"附件"` → `{t("goalInput.attachLabel")}`
- `title="移除"` → `title={t("goalInput.remove")}`
- `"处理中…"` → `{t("goalInput.processing")}`

### Step 3 — 修复 EvolutionPanel.tsx

- `"analyzing..."` → `{t("evolution.analyzing")}`

### Step 4 — 修复 AgentHeader.tsx

- `title="Agent World Platforms"` → `title={t("header.platformsTitle")}`
- `"Platforms"` (桌面 button span) → `{t("header.platforms")}`
- `"Platforms"` (mobile dropdown span) → `{t("header.platforms")}`

### Step 5 — 修复 Index.tsx

- `t("common.useAsPrompt", { defaultValue: ... })` → `t("common.useAsPrompt")` (删除 defaultValue，键现在已定义)

### Step 6 — 修复 harness-agent Edge Function

将 `memoryContext` 加入主 body 解构，删除 plan 分支内的重复解构。

### Step 7 — PlatformPanel DESENSITIZATION_EXEMPTION

在文件顶部 `ACCOUNTS` 常量上方加注释：
```typescript
// DESENSITIZATION_EXEMPTION: These are operational Agent World API keys needed
// for in-app copy functionality. Keys belong to project-owned accounts and are
// intentionally exposed via this internal operator panel. See AGENTS.md 2.3c.
```

并在 AGENTS.md 变更日志表格追加一条记录。

---

## 涉及文件

1. `src/i18n/locales/en.json`
2. `src/i18n/locales/zh.json`
3. `src/pages/Index.tsx`
4. `src/components/agent/GoalInput.tsx`
5. `src/components/agent/EvolutionPanel.tsx`
6. `src/components/agent/AgentHeader.tsx`
7. `src/components/agent/PlatformPanel.tsx`
8. `supabase/functions/harness-agent/index.ts`
9. `AGENTS.md`

---

## 验证

- 切换中英文，所有按钮/标题显示正确翻译，无 key 字符串出现
- `演化/Evolve` 流程正常，reflectionStream 期间显示 "分析中..." / "analyzing..."
- Platforms 按钮在桌面/移动端显示正确
- Edge Function plan 模式 memory context 注入逻辑不变
- PlatformPanel 复制功能不受影响
