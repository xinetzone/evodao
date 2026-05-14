const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.enter.pro/code/api/v1/ai/chat/completions";

// Lightweight fallback model for utility calls (suggest / optimize / reflect / intent)
const UTILITY_MODEL = "z-ai/glm-5.1";

interface EvolutionContext {
  round: number;
  qualityScore: number;
  improvements: string[];
  evolvedGoal: string;
}

function getEvolutionSection(evolutionContext?: EvolutionContext): string {
  if (!evolutionContext) return "";
  return `

EVOLUTION CONTEXT (Round ${evolutionContext.round}):
Previous quality score: ${evolutionContext.qualityScore}/100
Improvements to apply this round:
${evolutionContext.improvements.map((i: string) => `- ${i}`).join("\n")}
Refined goal: ${evolutionContext.evolvedGoal}

Apply these improvements proactively throughout your response.`;
}

function getPlanSystemPrompt(outputMode: string, evolutionContext?: EvolutionContext): string {
  const evoSection = getEvolutionSection(evolutionContext);
  if (outputMode === "agent") {
    return `You are a senior software architect planning the implementation of an agent project.
Decompose the goal into 3-6 implementation tasks. Each task should produce one or more concrete code files.
Return ONLY a valid JSON array with no markdown fences, no explanation. Use this exact format:
[{"id":1,"title":"Short Task Title","description":"One or two sentences describing what files this task creates.","dependsOn":[],"tools":["code"]},{"id":2,"title":"...","description":"...","dependsOn":[1],"tools":["code","write"]}]

Rules for "dependsOn":
- Value must be an array of task IDs whose OUTPUT this task genuinely needs as input.
- Root tasks (no dependency on others) must have "dependsOn": [].
- Maximise parallelism — only declare a dependency when absolutely necessary.
- Never create circular dependencies.

Rules for "tools":
- Declare the capabilities this task primarily relies on.
- Valid values: "code" (write/generate code), "write" (prose/docs), "analyze" (research/summarize), "search" (find info), "design" (UI/UX/visual).
- Each task should list 1-3 relevant tools.${evoSection}`;
  }
  return `You are a precise task planning agent. Given a goal, decompose it into 3-6 concrete, actionable sub-tasks.
Return ONLY a valid JSON array with no markdown fences, no explanation, no extra text. Use this exact format:
[{"id":1,"title":"Short Task Title","description":"One or two sentences describing what this task involves.","dependsOn":[],"tools":["analyze"]},{"id":2,"title":"...","description":"...","dependsOn":[1],"tools":["write"]}]

Rules for "dependsOn":
- Value must be an array of task IDs whose OUTPUT this task genuinely needs as input.
- Root tasks (no dependency on others) must have "dependsOn": [].
- Maximise parallelism — only declare a dependency when absolutely necessary.
- Never create circular dependencies.

Rules for "tools":
- Declare the capabilities this task primarily relies on.
- Valid values: "code" (write/generate code), "write" (prose/docs), "analyze" (research/summarize), "search" (find info), "design" (UI/UX/visual).
- Each task should list 1-3 relevant tools.${evoSection}`;
}

function getExecuteSystemPrompt(outputMode: string, tools?: string[], evolutionContext?: EvolutionContext): string {
  const evoSection = getEvolutionSection(evolutionContext);
  const toolHints = tools && tools.length > 0
    ? `\n\nThis task uses tools: [${tools.join(", ")}]. Tailor your response to leverage these capabilities.`
    : "";
  if (outputMode === "agent") {
    return `You are an expert software engineer implementing part of an agent project.
For EVERY file you create, you MUST use this exact format (language:filepath on the opening fence):

\`\`\`python:src/agent.py
# full file content here
\`\`\`

\`\`\`json:config/settings.json
{ "key": "value" }
\`\`\`

Rules:
- Use realistic relative file paths (e.g. src/agent.py, config/settings.json, README.md)
- Write complete, working code — no placeholders or TODOs
- Multiple files per task is encouraged
- Always include a README.md with setup and usage instructions in the first or last task${toolHints}${evoSection}`;
  }
  return `You are a skilled execution agent. Carry out assigned tasks thoroughly and produce high-quality, detailed outputs. Be specific, practical, and thorough. Use clear structure with headers and bullet points where helpful.${toolHints}${evoSection}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_8f02c91ef078");

    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const body = await req.json();
    const {
      mode,
      goal,
      task,
      context,
      tasks,
      taskOutputs,
      messages,
      outputMode = "text",
      evolutionContext,
      // model param — caller supplies the selected model; defaults to GLM 5.1
      model: requestedModel,
    } = body;

    // Resolved model for primary (plan / execute / chat) calls
    const primaryModel: string = requestedModel || "z-ai/glm-5.1";

    // ── INTENT DETECTION ─────────────────────────────────────────────────────
    if (mode === "intent") {
      const intentPrompt = `You are an intelligent workflow router for an AI agent platform. Given a user goal, classify it into the most suitable execution mode.

Available modes:
- "text"  — multi-step autonomous task execution (research, writing, planning, analysis)
- "agent" — software engineering / code generation (build apps, scripts, APIs, configs)
- "qa"    — conversational Q&A, single-turn questions, quick lookups
- "image" — visual output: generate images, illustrations, diagrams

User goal: "${goal}"

Return ONLY valid JSON, no markdown fences:
{"outputMode":"text","reason":"One-sentence explanation of why this mode fits best."}`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: intentPrompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Intent LLM error");

      const data = await response.json();
      const content = (data.choices?.[0]?.message?.content || "{}").trim();
      let result = { outputMode: "text", reason: "" };
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch { /* fall back to text mode */ }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── SUGGEST ───────────────────────────────────────────────────────────────
    } else if (mode === "suggest") {
      const { taskSummary, lastQA } = body;

      const modeLabel = outputMode === "agent" ? "software agent build" : outputMode === "qa" ? "Q&A exploration" : "autonomous task execution";

      let contextInfo = `Goal: ${goal}\nMode: ${modeLabel}`;
      if (taskSummary) contextInfo += `\n\nCompleted work summary:\n${taskSummary}`;
      if (lastQA) contextInfo += `\n\nLast Q&A exchange:\n${lastQA}`;

      const prompt = `You are a creative AI prompt engineer. Based on the following completed conversation context, generate 3 diverse, high-quality follow-up prompts the user might want to explore next.

${contextInfo}

Rules:
- Each prompt should be 1-2 concise sentences
- Make them meaningfully different from each other
- Keep them actionable and specific
- Tailor them for "${modeLabel}" mode

Return ONLY a JSON array of exactly 3 strings. No explanations, no markdown fences.
["prompt 1", "prompt 2", "prompt 3"]`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Suggest LLM error");

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      let suggestions = [];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestions = JSON.parse(cleaned);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch { suggestions = []; }

      return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── OPTIMIZE ──────────────────────────────────────────────────────────────
    } else if (mode === "optimize") {
      const modeDesc = outputMode === "agent"
        ? "a software development project specification (be detailed, structured, and implementation-ready)"
        : outputMode === "qa"
        ? "a question (make it precise, specific, and likely to get a comprehensive answer)"
        : "an autonomous AI agent task goal (be clear, actionable, and specific)";

      const prompt = `You are an expert prompt engineer. Rewrite the following prompt to be more effective for ${modeDesc}.

Original prompt: "${goal}"

Rules:
- Preserve the core intent exactly
- Make it more specific and actionable
- Add concrete constraints or success criteria where beneficial
- Keep it concise (no longer than 2-3 sentences)

Return ONLY the optimized prompt text. No explanation, no quotes, no preamble.`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Optimize LLM error");

      const data = await response.json();
      const optimizedPrompt = (data.choices?.[0]?.message?.content || goal).trim();

      return new Response(JSON.stringify({ optimizedPrompt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── CHAT (Q&A) ────────────────────────────────────────────────────────────
    } else if (mode === "chat") {
      const chatMessages = messages && messages.length > 0
        ? messages
        : [{ role: "user", content: goal }];

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: primaryModel,
          messages: [
            { role: "system", content: "You are a knowledgeable, helpful assistant. Answer clearly and accurately. Use markdown formatting (headers, bullet points, code blocks) when it aids readability." },
            ...chatMessages,
          ],
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Chat LLM error: ${text}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });

    // ── PLAN ─────────────────────────────────────────────────────────────────
    } else if (mode === "plan") {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: primaryModel,
          messages: [
            { role: "system", content: getPlanSystemPrompt(outputMode, evolutionContext) },
            { role: "user", content: `Goal: ${goal}` },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Planning LLM error: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";

      let taskList = [];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        taskList = JSON.parse(cleaned);
      } catch {
        throw new Error("Failed to parse task plan from AI response");
      }

      return new Response(JSON.stringify({ tasks: taskList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── EXECUTE ───────────────────────────────────────────────────────────────
    } else if (mode === "execute") {
      const contextSection = context && context.length > 0
        ? `\n\nContext from previously completed tasks:\n${context.join("\n\n")}`
        : "";

      const userPrompt = outputMode === "agent"
        ? `Overall Goal: ${goal}\n\nCurrent Task:\nTitle: ${task.title}\nDescription: ${task.description}${contextSection}\n\nImplement this task completely. Output every file using the \`\`\`language:path format. Write full, working code.`
        : `Overall Goal: ${goal}\n\nCurrent Task to Execute:\nTitle: ${task.title}\nDescription: ${task.description}${contextSection}\n\nPlease execute this task completely and provide detailed, actionable output.`;

      // Use task.tools to customize system prompt behaviour
      const taskTools: string[] | undefined = task?.tools;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: primaryModel,
          messages: [
            { role: "system", content: getExecuteSystemPrompt(outputMode, taskTools, evolutionContext) },
            { role: "user", content: userPrompt },
          ],
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = "AI service error";
        const dataMatch = text.match(/data: (.+)/);
        if (dataMatch) {
          try {
            const errorData = JSON.parse(dataMatch[1]);
            errorMessage = errorData.error?.message || errorMessage;
          } catch { /* use default */ }
        }
        const errorSSE = `event: error\ndata: ${JSON.stringify({ error: { message: errorMessage, type: "api_error" } })}\n\n`;
        return new Response(errorSSE, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });

    // ── REFLECT ───────────────────────────────────────────────────────────────
    } else if (mode === "reflect") {
      const taskSummaryText = (tasks || []).map((t: { id: number; title: string }) => {
        const output = ((taskOutputs || {})[t.id] || "").substring(0, 600);
        return `Task ${t.id}: ${t.title}\n${output}`;
      }).join("\n\n---\n\n");

      const reflectPrompt = `You are a critical AI quality evaluator. Review the following completed agent run and evaluate it honestly.

Original Goal: ${goal}

Completed Tasks and Outputs:
${taskSummaryText}

Evaluate the quality. Be specific and constructive.
Return ONLY this exact JSON (no markdown fences, no explanation outside the JSON):
{
  "qualityScore": 75,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "improvements": ["concrete improvement direction 1", "concrete improvement direction 2"],
  "evolvedGoal": "a refined version of the original goal that addresses the weaknesses and builds on strengths"
}`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: reflectPrompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Reflection LLM error");

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";

      let result;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        throw new Error("Failed to parse reflection from AI response");
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
  } catch (error) {
    const errorSSE = `event: error\ndata: ${JSON.stringify({ error: { message: error.message, type: "api_error" } })}\n\n`;
    return new Response(errorSSE, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }
});
