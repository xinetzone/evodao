# Plan: Force Chinese Output in QA Mode When Interface Is Chinese

## Context

In QA (探索问答) mode with Chinese interface selected, the LLM (e.g., GLM 5.1)
responds in English when the user sends an English word like "hi".

**Root cause**: The current approach appends a `CRITICAL LANGUAGE RULE` instruction
at the END of an English system prompt. Many models (especially GLM) default to
mirroring the user's input language and override the trailing instruction.

The language rule at the end:
```
You are a knowledgeable, helpful assistant... CRITICAL LANGUAGE RULE: ... respond in Chinese
```
...is insufficient when the model's "respond in user's language" heuristic overrides it.

## Fix

Write the chat system prompt **entirely in Chinese** when `lang === "zh"`.
When the system prompt is in Chinese, the model naturally operates in a Chinese context.
Additionally, explicitly state "无论用户使用何种语言提问" (regardless of the user's language).

### File: `supabase/functions/harness-agent/index.ts`

Replace the single-string `chatSystemPrompt` with a language-conditional version:

```typescript
// BEFORE:
const chatSystemPrompt = `You are a knowledgeable, helpful assistant. Answer clearly and accurately. Use markdown formatting (headers, bullet points, code blocks) when it aids readability.${getLanguageInstruction(lang)}`;

// AFTER:
const chatSystemPrompt = lang === "zh"
  ? `你是一位博学、乐于助人的AI助手。无论用户使用何种语言提问，你必须始终用简体中文回答。回答要清晰、准确，必要时使用Markdown格式（标题、列表、代码块）提升可读性。只有代码标识符、文件路径和命令行指令可以保留英文，其余内容必须是中文。`
  : `You are a knowledgeable, helpful assistant. Answer clearly and accurately. Use markdown formatting (headers, bullet points, code blocks) when it aids readability.`;
```

## Why This Works

| Approach | Problem |
|----------|---------|
| English prompt + trailing "respond in Chinese" | Model mirrors user's English input, ignores trailing rule |
| **Chinese system prompt + explicit instruction** | Model reads Chinese context first → naturally responds in Chinese |

## Verification

1. Switch UI to Chinese (中文)
2. In QA mode, type "hi" → response should be in Chinese ("你好！有什么我可以帮助你的吗？")
3. Type an English question → response should still be in Chinese
4. Switch UI to English (EN) → type "hi" → response should be in English
5. Switch back to Chinese → verify Chinese responses persist
