# Harness Agent — ZIP Export for Multi-File Agent Projects

## Context
User wants a dedicated "Agent Build" mode where the LLM outputs structured source files.
Files are parsed from code blocks, shown in a file tree, and exported as a `.zip` archive.

---

## Architecture Overview

```
User toggles "Agent Build" mode
  → GoalInput sends outputMode: "agent"
  → Edge Function uses file-oriented prompts
  → LLM outputs code blocks: ```lang:path/to/file
  → Frontend parses AgentFile[] after each task
  → FileTree component displays files
  → "Download ZIP" button packs all files via jszip
```

---

## File Convention (LLM output format)

```
```python:agents/main.py
...code content...
```

```json:config/settings.json
...json content...
```
```

Parser regex: `` /```(\w+):([^\n]+)\n([\s\S]*?)```/g ``

---

## New Dependency

```
jszip
```

---

## New Types (add to `useHarnessAgent.ts`)

```typescript
export type OutputMode = "text" | "agent";

export interface AgentFile {
  path: string;
  content: string;
  language: string;
  taskId: number;
}

// Add to HistoryEntry:
export interface HistoryEntry {
  ...existing fields...
  outputMode?: OutputMode;
  extractedFiles?: AgentFile[];
}
```

---

## Files

### New
| File | Purpose |
|---|---|
| `src/lib/parseFiles.ts` | Parse `\`\`\`lang:path` code blocks from text |
| `src/components/agent/FileTree.tsx` | Display extracted files with expand/collapse |

### Modified
| File | Change |
|---|---|
| `supabase/functions/harness-agent/index.ts` | Add `outputMode` param + agent-mode system prompts |
| `src/hooks/useHarnessAgent.ts` | Add `outputMode`, `extractedFiles` state; parse after each task |
| `src/components/agent/GoalInput.tsx` | Add mode toggle (Task / Agent Build) |
| `src/components/agent/ExportActions.tsx` | Add ZIP download button (shown when files > 0) |
| `src/lib/exportUtils.ts` | Add `downloadZip(files, name)` using jszip |
| `src/pages/Index.tsx` | Show `<FileTree>` when `extractedFiles.length > 0` |
| `src/i18n/locales/en.json` + `zh.json` | Add `mode.*` and `fileTree.*` i18n keys |

---

## Implementation Details

### 1. `src/lib/parseFiles.ts`
```typescript
export function parseFilesFromOutput(output: string, taskId: number): AgentFile[] {
  const regex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
  const files: AgentFile[] = [];
  let match;
  while ((match = regex.exec(output)) !== null) {
    files.push({ language: match[1], path: match[2].trim(), content: match[3], taskId });
  }
  return files;
}
```

### 2. Edge Function — agent mode prompts

**Plan (agent mode):**
```
You are a software architect. Decompose this agent project goal into 3-6 implementation tasks (files/modules).
Each task should correspond to a specific component of the agent (e.g., "Core Agent Logic", "Config & Dependencies", "README").
Return JSON only: [{"id":1,"title":"...","description":"..."}]
```

**Execute (agent mode):**
```
You are an expert software engineer building an agent project.
For each file you create, use EXACTLY this format (no exceptions):
```language:path/to/filename.ext
...file content...
```
Multiple files per task are allowed. Write complete, production-ready code.
```

### 3. `useHarnessAgent` changes
- Add `outputMode: OutputMode` state (default `"text"`)
- Add `extractedFiles: AgentFile[]` state
- Pass `outputMode` to Edge Function in plan/execute requests
- After each task completes: parse output → append to `extractedFiles`
- Expose `setOutputMode` for GoalInput toggle
- Clear `extractedFiles` on `reset()`
- Include `outputMode` + `extractedFiles` in `HistoryEntry` (so history can also ZIP-export)

### 4. `GoalInput` mode toggle
- Two-state pill toggle: `[TASK] [AGENT BUILD]`
- Only shown when `status === "idle"` (can't switch mid-run)
- Calls `onModeChange(mode)` prop

### 5. `FileTree` component
- Shows files grouped by `taskId` (collapsible task group headers)
- Each file row: language icon (via extension mapping) + path + expand button
- Expanded: `<pre>` with file content (monospace, scrollable, max-h-48)
- Header: "X files extracted" + `<ExportActions>` ZIP button

### 6. `exportUtils.ts` addition
```typescript
export async function downloadZip(files: AgentFile[], name: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.content));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadMarkdown(blob, `${name}.zip`); // reuse download helper
}
```

### 7. `ExportActions` ZIP button
- Show "DOWNLOAD .ZIP" button only when `files` prop is provided and `files.length > 0`
- Existing Copy/Download .MD buttons unchanged

### 8. i18n keys to add
```json
"mode": {
  "task": "TASK",
  "agent": "AGENT BUILD",
  "toggle": "Output Mode"
},
"fileTree": {
  "header": "{{count}} files extracted",
  "expand": "Expand",
  "collapse": "Collapse"
},
"export": {
  "downloadZip": "DOWNLOAD .ZIP"
}
```

---

## Index.tsx layout change
```tsx
{extractedFiles.length > 0 && (
  <FileTree files={extractedFiles} goal={currentGoal} />
)}
```
Placed after `<TaskList>` and before `<TerminalOutput>`.

---

## Verification
1. Toggle to "Agent Build" mode
2. Enter goal like "Build a Python RSS monitoring agent"
3. Tasks are planned with agent-oriented descriptions
4. Each task execution outputs ` ```lang:path ` blocks
5. FileTree populates as tasks complete
6. "Download .ZIP" button downloads archive with correct file structure
7. ZIP contains all extracted source files at correct paths
8. History detail view also shows ZIP download for agent-mode sessions
