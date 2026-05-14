# Attachment Upload for GoalInput

## Context
User wants to attach files (images + documents) to the input dialog. All attachments are **injected as text context** into the Agent. Images are also passed as multimodal content (base64) to vision-capable models in QA mode.

## Supported File Types
| Type | Extension | Processing |
|------|-----------|-----------|
| Image | jpg/jpeg/png/gif/webp | Browser FileReader - base64 data URL; preview thumbnail |
| Text doc | txt/md/json/csv | FileReader.readAsText - raw text content |
| PDF | .pdf | pdfjs-dist (dynamic import) - extracted text |

Max size: 10 MB per file.

## Architecture: All Client-Side, No New Edge Function

Data flow:
1. User clicks Paperclip icon - file picker opens
2. Files processed client-side - Attachment[] state
3. On Run - attachments passed to startAgent(goal, mode, model, attachments)
4. useEvodaoAgent builds attachmentContext string from text/doc attachments + collects image data URLs
5. For plan / execute modes: enrichedGoal = goal + "\n\n" + attachmentContext
6. For chat (QA) mode: first user message uses multimodal content array with image_url items
7. harness-agent edge function receives enriched goal/messages - supports imageDataUrls

## Files to Create / Modify

### 1. NEW: src/hooks/useAttachments.ts
- addFiles(files: File[]) - validates, processes each file asynchronously
- Image: FileReader.readAsDataURL -> dataUrl; URL.createObjectURL -> previewUrl
- Text (txt/md/json/csv): FileReader.readAsText -> textContent
- PDF: dynamic import('pdfjs-dist') -> extract text pages -> textContent
- removeAttachment(id: string)
- clearAttachments()
- PDF worker URL: https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs
- Max size: 10 MB; show error on file if exceeded

### 2. MODIFIED: src/components/agent/GoalInput.tsx
- Add Paperclip icon button in bottom toolbar (left side, next to char count)
- Hidden <input type="file"> accepts image/*,.txt,.md,.csv,.json,.pdf
- Attachment preview strip between suggestion chips and input box:
  - Each chip: thumbnail (images) or FileText icon (documents) + filename + loading spinner/X
  - Horizontal scroll when overflow
- onRun signature: add attachments: Attachment[] 4th param
- Disable run button while any attachment isLoading === true

### 3. MODIFIED: src/pages/Index.tsx
- GoalInput.onRun now receives attachments
- Pass attachments to agent.startAgent(goal, mode, model, attachments)

### 4. MODIFIED: src/hooks/useEvodaoAgent.ts
- startAgent(goal, outputMode, model, attachments?: Attachment[]) new param
- Build textContext from docs, enrichedGoal for plan+execute
- For chat mode: build multimodal userContent when imageDataUrls present
- Pass enrichedGoal to planTasks and executeTask

### 5. MODIFIED: supabase/functions/harness-agent/index.ts
- In chat mode: accept imageDataUrls?: string[] in request body
- Build first user message with multimodal content array when images present

## buildTextContext Helper
Formats doc/text attachments into a context block prepended to the goal.
Each attachment: "[附件: filename]\n{content.slice(0, 8000)}"
Wrapped in "--- 附件内容 ---" / "--- 附件内容结束 ---"

## Dependency to Add
- pdfjs-dist@4.4.168 (dynamic import for lazy loading)

## Verification
1. Upload .txt -> text injected into agent context
2. Upload PDF -> text extracted and injected
3. Upload image -> thumbnail shown; QA mode AI can analyze it
4. X button removes attachment
5. Run disabled while file loading
6. 10MB+ file shows per-attachment error
