import { AgentFile } from "@/hooks/useHarnessAgent";

/**
 * Extracts structured files from LLM output.
 * Looks for code fences in the format:
 *   ```language:path/to/file.ext
 *   content
 *   ```
 */
export function parseFilesFromOutput(output: string, taskId: number): AgentFile[] {
  // Matches ```lang:path\ncontent``` (non-greedy)
  const regex = /```(\w+):([^\n`]+)\n([\s\S]*?)```/g;
  const files: AgentFile[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    const path = m[2].trim();
    if (!path) continue;
    files.push({
      language: m[1].toLowerCase(),
      path,
      content: m[3],
      taskId,
    });
  }
  return files;
}
