# Plan: User Guide (Help Modal)

## Context

Add an in-app user guide to help users understand EVODAO's 4 modes (任务/构建/问答/图像),
key features, and shortcuts. Accessible from a "?" button in the header.

---

## Approach

A centered **Dialog/Modal** with tab navigation — consistent with the app's existing modal
style (PricingModal pattern). Content is fully i18n'd across zh/en.

---

## New Files

### `src/components/agent/HelpModal.tsx`

A dialog with 6 tabs:

| Tab | Key Content |
|-----|-------------|
| 快速入门 | 4-step getting started: 输入目标 → 选择模式 → 选择模型 → 执行 |
| 任务模式 | Description + 3 use cases + example prompt |
| 构建模式 | Description + 3 use cases + example prompt + ZIP export note |
| 探索问答 | Description + multi-turn chat note + example prompt |
| 图像生成 | Description + 3 use cases + example prompt |
| 使用技巧 | Keyboard shortcuts table + memory feature + model tips |

**Design:**
- Reuse `Dialog / DialogContent` from `src/components/ui/dialog.tsx`
- Left sidebar tabs (icon + label), right content area
- Each mode tab has: colored icon, title, subtitle/desc, use-case bullets, example prompt chip
- Tips tab: keyboard shortcut table + feature cards

---

## Modified Files

### `src/components/agent/AgentHeader.tsx`
- Add `onHelpOpen: () => void` prop
- Add `HelpCircle` icon button (desktop: in header button row; mobile: in user dropdown)

### `src/pages/Index.tsx`
- Add `const [helpOpen, setHelpOpen] = useState(false)`
- Pass `onHelpOpen={() => setHelpOpen(true)}` to `<AgentHeader>`
- Render `<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />`

### `src/i18n/locales/zh.json` + `en.json`
Add `guide` section with all tab titles, content strings, and tip keys (~50 keys total).

---

## i18n Keys Structure

```json
"guide": {
  "title": "使用指南",
  "tabs": { "start": "快速入门", "task": "任务模式", "agent": "构建模式",
            "qa": "探索问答", "image": "图像生成", "tips": "使用技巧" },
  "start": { "step1Title": "输入目标", "step1Desc": "...",
             "step2Title": "选择模式", "step2Desc": "...",
             "step3Title": "选择模型", "step3Desc": "...",
             "step4Title": "执行", "step4Desc": "..." },
  "task": { "desc": "...", "uc1": "...", "uc2": "...", "uc3": "...", "example": "..." },
  "agent": { "desc": "...", "uc1": "...", "uc2": "...", "uc3": "...", "example": "..." },
  "qa": { "desc": "...", "uc1": "...", "uc2": "...", "uc3": "...", "example": "..." },
  "image": { "desc": "...", "uc1": "...", "uc2": "...", "uc3": "...", "example": "..." },
  "tips": {
    "shortcutsTitle": "快捷键",
    "shortcuts": [["Enter", "执行任务"], ["Shift+Enter", "换行"], ["Esc", "重置/关闭"]],
    "memoryTitle": "长期记忆", "memoryDesc": "...",
    "quotaTitle": "配额说明", "quotaDesc": "...",
    "modelTitle": "模型选择", "modelDesc": "..."
  }
}
```

---

## Verification

1. Click "?" button → modal opens with Quick Start tab selected
2. Navigate all 6 tabs, content renders with correct icons
3. Toggle language → all text switches zh↔en
4. Mobile: "?" accessible from user dropdown
