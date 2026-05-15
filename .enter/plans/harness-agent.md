# Plan: Force Chinese Output Across ALL Modes

## Context

All agent modes (chat, plan, execute, reflect, suggest, optimize) currently append
the language rule at the END of English system prompts. Models (GLM, Gemini, etc.)
default to mirroring the user's input language and ignore trailing rules.

## Fix: Move Language Instruction to PREFIX

Change `getLanguageInstruction` to return a preamble that goes BEFORE the role
description, so the model reads the language rule first.

Also rewrite the chat system prompt entirely in Chinese when lang === "zh".

## File: `supabase/functions/harness-agent/index.ts`

### 1. Rewrite `getLanguageInstruction` as a prefix

```
// BEFORE — appended suffix (ignored by models):
return `\n\nCRITICAL LANGUAGE RULE: ...respond in Chinese`;

// AFTER — prepended prefix (read first):
return `[LANGUAGE: zh] All text output MUST be in Simplified Chinese. Code identifiers, file paths, and CLI commands may stay in English. This is mandatory regardless of the user's input language.\n\n`;
```

### 2. All `getLanguageInstruction(lang)` call sites: move to PREFIX

Affected locations (all currently use `...${langInstruction}` at the end):

- `getPlanSystemPrompt` — agent branch (line ~64) and text branch (line ~79)
- `getExecuteSystemPrompt` — agent branch (line ~104) and text branch (line ~106)
- `reflectSystemPrompt` (line ~630)
- `suggest` prompt (line ~362)
- `optimize` prompt (line ~401)

Pattern change:
```
BEFORE: return `You are a ... role ...${langInstruction}`;
AFTER:  return `${langInstruction}You are a ... role ...`;
```

### 3. Chat mode: full Chinese system prompt when lang === "zh"

```typescript
const chatSystemPrompt = lang === "zh"
  ? `[LANGUAGE: zh] All output MUST be in Simplified Chinese regardless of user input language.\n\n你是一位博学、乐于助人的AI助手。回答清晰准确，必要时使用Markdown格式（标题、列表、代码块）提升可读性。`
  : `You are a knowledgeable, helpful assistant. Answer clearly and accurately. Use markdown formatting (headers, bullet points, code blocks) when it aids readability.`;
```

## Verification

1. Chinese UI + QA mode + type "hi" → response in Chinese
2. Chinese UI + task mode → task titles and output in Chinese
3. Chinese UI + suggestions → suggestions in Chinese
4. English UI → responses in English
