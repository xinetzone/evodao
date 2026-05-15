# 中文模式语言强制执行 + 可复用 Skill

## Context

截图显示系统已切换为中文模式（中文按钮已激活），但 LLM 生成内容（任务规划、任务执行、AI 建议、优化提示词、自我反思）仍可能输出英文。原因：Edge Function 中所有系统提示词均为英文，前端从未将当前语言传递给后端。

目标：中文模式下所有 LLM 输出（任务标题/描述、执行结果、建议词、自我反思、QA 回答）严格使用中文；同时将该实现模式封装为可复用 Enter Skill。

---

## 涉及的 Fetch 调用（全部需要注入 `lang`）

| 位置 | mode | 是否影响用户可见内容 |
|------|------|---------------------|
| `useEvodaoAgent.ts:266` | `plan` | ✅ 任务标题 / 描述 |
| `useEvodaoAgent.ts` executeTask | `execute` | ✅ 任务输出正文 |
| `useEvodaoAgent.ts` QA section | `chat` | ✅ QA 回答 |
| `useEvodaoAgent.ts` evolve | `reflect` | ✅ 反思评估文本 |
| `Index.tsx:102` | `suggest` | ✅ 推荐提示词 |
| `GoalInput.tsx:153` | `optimize` | ✅ 优化后提示词 |
| `GoalInput.tsx:180` | `intent` | ❌（JSON 结构体，不显示给用户，无需 lang） |

---

## 修复方案

### Step 1 — Edge Function：新增语言指令生成器

`supabase/functions/harness-agent/index.ts`

```typescript
function getLanguageInstruction(lang?: string): string {
  if (lang === "zh") {
    return `\n\nCRITICAL LANGUAGE RULE: The user interface is set to Chinese (简体中文). You MUST respond entirely in Simplified Chinese. ALL output — task titles, descriptions, analysis, summaries, evaluation text, prose, and explanations — MUST be in Chinese. Only code identifiers, file paths, CLI commands, and reserved programming keywords may remain in English. Never mix languages. Respond in Chinese only.`;
  }
  return "";
}
```

将 `lang` 加入 body 主解构，然后在以下各处拼接：
- `getPlanSystemPrompt(outputMode, evolutionContext)` → 函数签名加 `lang?`, 末尾追加 `getLanguageInstruction(lang)`
- `getExecuteSystemPrompt(outputMode, tools, evolutionContext)` → 同上
- `chatSystemPrompt`（chat 分支内联字符串末尾追加）
- `reflectSystemPrompt`（reflect 分支内联字符串末尾追加）
- `suggest` 分支的 `prompt` 字符串末尾追加
- `optimize` 分支的 `prompt` 字符串末尾追加
- `memory_summarize` 分支的 `prompt` 字符串末尾追加（可选，影响记忆摘要语言）

### Step 2 — `useEvodaoAgent.ts`：读取当前语言

在文件顶部新增：
```typescript
import i18n from "@/i18n";
```

在以下位置的 JSON body 中加入 `lang: i18n.language`：
- `planTasks()` fetch body
- `executeTask()` fetch body（`fetchEventSource` body）
- `runAgent()` QA 模式 fetch body（`mode: "chat"`）
- `evolve()` fetch body（`mode: "reflect"`）

### Step 3 — `Index.tsx`：传递语言到 suggest

重新加回 `i18n` 到 `useTranslation()` 解构：
```typescript
const { t, i18n } = useTranslation();
```
在 `fetchSuggestions` 的 fetch body 中加入 `lang: i18n.language`。

### Step 4 — `GoalInput.tsx`：传递语言到 optimize

`GoalInput.tsx` 已有 `const { t } = useTranslation()`，将其改为：
```typescript
const { t, i18n } = useTranslation();
```
在 `mode: "optimize"` fetch body 中加入 `lang: i18n.language`。

---

## 可复用 Skill

创建 `/workspace/skill-drafts/custom/zh-lang-enforcement@1/SKILL.md`

内容：描述此"LLM 多语言强制执行"模式 —— 如何在 Edge Function 中注入语言指令、如何从前端传递 `lang` 参数——供其他项目复用。

---

## 涉及文件

1. `supabase/functions/harness-agent/index.ts`
2. `src/hooks/useEvodaoAgent.ts`
3. `src/pages/Index.tsx`
4. `src/components/agent/GoalInput.tsx`
5. `skill-drafts/custom/zh-lang-enforcement@1/SKILL.md` （新建 Skill）

---

## 验证

- 切换到中文模式，输入"制定SaaS产品营销策略"执行任务模式 → 任务标题、描述、执行输出全为中文
- QA 模式提问中文问题 → 回答全为中文
- 点击"推荐提示词" → 生成的 3 条建议全为中文
- 优化按钮 → 优化后提示词为中文
- 点击 EVOLVE → 反思评估文本为中文
- 切换英文模式同样操作 → 输出恢复英文（无语言指令时模型自然回英文）
