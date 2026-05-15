# Prompt Library Picker

## Context
Users currently see 4-5 static chips that rotate per mode. Request is for a
**"提示词库选型"** — a browseable library of curated prompts, organized by
category, with search, so users can quickly find and apply a high-quality prompt.

## Approach

### Data layer — `src/data/promptLibrary.ts` (NEW)
Typed structure: each `PromptCategory` has `id`, `icon`, `labelZh`, `labelEn`,
`mode` (or `"all"`), and `items[]` with `zh` / `en` prompt strings.

Scope: 4 categories per mode × 3 prompts = ~48 prompts.
Modes: text, agent, qa, image — each with its own category set.

```ts
export interface PromptItem { zh: string; en: string; }
export interface PromptCategory {
  id: string;
  icon: string;          // lucide icon name key
  labelZh: string;
  labelEn: string;
  mode: OutputMode | "all";
  items: PromptItem[];
}
export const PROMPT_LIBRARY: PromptCategory[] = [ ... ]
```

### Modal — `src/components/agent/PromptLibraryModal.tsx` (NEW)
Full-overlay modal (same backdrop pattern as HelpModal):

**Layout** (responsive):
- Header: "提示词库" title + search input (right side) + close button
- Body: left sidebar (category list, 120px wide) + right content (prompt cards grid)
- Mobile: category tabs scroll horizontally at top, no sidebar

**Features:**
- Category filter: click sidebar item → shows that category's prompts
- Search: filters prompts by text match against current language
- Click a prompt card → calls `onSelect(text)` → closes modal
- Shows mode badge on each category

**Component signature:**
```ts
interface PromptLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  currentMode: OutputMode;  // pre-selects the right category
}
```

### GoalInput wiring — `src/components/agent/GoalInput.tsx`
1. Add `libraryOpen` state (default false)
2. In the suggestions label row, add `BookOpen` icon button to the right of the label:
   ```tsx
   <button onClick={() => setLibraryOpen(true)} title={t("promptLib.openBtn")}>
     <BookOpen className="w-3 h-3" />
   </button>
   ```
3. Render `<PromptLibraryModal>` at bottom of component:
   ```tsx
   <PromptLibraryModal
     open={libraryOpen}
     onClose={() => setLibraryOpen(false)}
     onSelect={(text) => { handleSuggestionClick(text); setLibraryOpen(false); }}
     currentMode={outputMode}
   />
   ```

### i18n — `zh.json` + `en.json`
Add minimal `promptLib` section (UI labels only — prompt text lives in `promptLibrary.ts`):
```json
"promptLib": {
  "title": "提示词库",
  "search": "搜索提示词...",
  "openBtn": "打开提示词库",
  "allModes": "全部",
  "noResults": "没有匹配的提示词",
  "apply": "使用"
}
```

## Library Content Plan (promptLibrary.ts)

### text mode
| Category | id | Prompts (3 each) |
|---|---|---|
| 内容创作 | content | 博客文章/口播脚本/内容日历 |
| 市场营销 | marketing | 品牌定位/广告文案/增长策略 |
| 数据分析 | analysis | 竞品分析/行业研究/用户访谈 |
| 商业策略 | strategy | 市场进入/商业计划/融资叙事 |

### agent mode
| Category | id | Prompts (3 each) |
|---|---|---|
| 后端/API | backend | FastAPI服务/Auth系统/GraphQL |
| 前端/UI | frontend | React组件/Dashboard/landing页面 |
| 数据工具 | datatools | 爬虫/ETL流水线/分析脚本 |
| AI工程 | aieng | RAG系统/LLM工具链/向量检索 |

### qa mode
| Category | id | Prompts (3 each) |
|---|---|---|
| 技术原理 | techprinciple | Transformer/系统设计/算法 |
| 产品商业 | bizproduct | 商业模式/增长/竞争策略 |
| 学习概念 | learning | 对比分析/类比解释/入门问题 |

### image mode
| Category | id | Prompts (3 each) |
|---|---|---|
| 商业设计 | commercial | Logo/封面/品牌素材 |
| 艺术风格 | artistic | 赛博朋克/水彩/极简主义 |
| 场景环境 | scene | 城市夜景/自然风光/未来建筑 |

Total: 39 prompts × 2 languages = 78 prompt strings

## Files Modified
- `src/data/promptLibrary.ts` (NEW)
- `src/components/agent/PromptLibraryModal.tsx` (NEW)
- `src/components/agent/GoalInput.tsx` (add button + modal)
- `src/i18n/locales/zh.json` (add `promptLib` section)
- `src/i18n/locales/en.json` (add `promptLib` section)

## Verification
- Click BookOpen icon → modal opens
- Category sidebar filters to mode-relevant categories by default
- Search "FastAPI" → shows matching agent prompts
- Click a prompt → fills input, modal closes
- Clicking backdrop closes modal
