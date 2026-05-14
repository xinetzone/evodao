const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenAI-compatible endpoint (GPT, DeepSeek, Kimi, GLM, etc.)
const API_BASE = "https://api.enter.pro/code/api/v1/ai/chat/completions";
// Anthropic Messages endpoint (Claude models)
const API_BASE_MESSAGES = "https://api.enter.pro/code/api/v1/ai/messages";

// Lightweight fallback model for utility calls (suggest / optimize / reflect / intent)
const UTILITY_MODEL = "z-ai/glm-5.1";

// Detect Claude / Anthropic models
function isClaudeModel(model: string): boolean {
  return model.startsWith("anthropic/");
}

// Claude Opus 4.x models require extended thinking (budget_tokens must be set)
function isOpus4Model(model: string): boolean {
  return model.includes("claude-opus-4");
}

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

/**
 * Translates Anthropic SSE stream to OpenAI-compatible SSE format.
 * The frontend expects OpenAI format (choices[0].delta.content etc.),
 * so we normalise here and keep the frontend parser unchanged.
 */
function translateAnthropicToOpenAI(anthropicStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // Shared decoder preserves state for multi-byte UTF-8 sequences split across chunks
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEmitted = false;

  function emitDone(controller: TransformStreamDefaultController<Uint8Array>) {
    if (doneEmitted) return;
    doneEmitted = true;
    controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n`));
    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
  }

  function processLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (!line.startsWith("data: ")) return;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr) return;

    let event: Record<string, unknown>;
    try { event = JSON.parse(jsonStr); } catch { return; }

    const eventType = event.type as string;

    if (eventType === "content_block_delta") {
      const delta = event.delta as Record<string, unknown>;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        const oaiChunk = { choices: [{ delta: { content: delta.text }, finish_reason: null }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(oaiChunk)}\n\n`));
      }
      // thinking_delta is silently skipped — thinking content is internal reasoning
    } else if (eventType === "message_stop") {
      emitDone(controller);
    } else if (eventType === "message_delta") {
      const usage = (event.usage ?? (event as Record<string, unknown>)) as Record<string, number>;
      if (usage?.output_tokens !== undefined) {
        const uChunk = {
          usage: {
            prompt_tokens: usage.input_tokens ?? 0,
            completion_tokens: usage.output_tokens ?? 0,
            total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(uChunk)}\n\n`));
      }
    } else if (eventType === "error") {
      const err = event.error as Record<string, string>;
      const errChunk = { error: { message: err?.message ?? "Claude error", type: err?.type ?? "api_error" } };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(errChunk)}\n\n`));
    }
    // Silently skip: message_start, content_block_start, content_block_stop, ping
  }

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line, controller);
    },
    flush(controller) {
      // Flush any remaining bytes in the TextDecoder
      const tail = decoder.decode();
      if (tail) buffer += tail;

      // Process any remaining buffered lines
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) processLine(line, controller);
      }

      // Safety net: if Anthropic never sent message_stop (e.g. error/truncation),
      // always emit [DONE] so the client SSE parser doesn't hang waiting.
      emitDone(controller);
    }
  });

  // Pipe async; errors are propagated to transform.readable automatically
  anthropicStream.pipeTo(transform.writable).catch(() => {
    // pipeTo errors close transform.writable, which triggers flush and closes
    // transform.readable — the client will see stream end and onclose fires.
  });
  return transform.readable;
}

/**
 * Non-streaming call — returns the assistant text content.
 * Handles both OpenAI (choices[0].message.content) and
 * Anthropic (content[].text) response shapes.
 */
async function callLLMNonStream(
  token: string,
  model: string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  if (isClaudeModel(model)) {
    const opus4 = isOpus4Model(model);
    const requestBody: Record<string, unknown> = {
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      stream: false,
      max_tokens: opus4 ? 16000 : 8192,
    };
    // Opus 4.x requires extended thinking; budget_tokens must be < max_tokens
    if (opus4) {
      requestBody.thinking = { type: "enabled", budget_tokens: 8000 };
    }
    const res = await fetch(API_BASE_MESSAGES, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Planning LLM error (Claude): ${txt}`);
    }
    const data = await res.json();
    // Anthropic: { content: [{type:"thinking",...},{type:"text",text:"..."}] }
    const block = (data.content as Array<{ type: string; text?: string }>)
      ?.find((b) => b.type === "text");
    return block?.text ?? "[]";
  } else {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: false,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Planning LLM error: ${txt}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "[]";
  }
}

/**
 * Streaming call — returns { response, isAnthropic }.
 * Caller is responsible for translating the stream if isAnthropic === true.
 */
async function callLLMStream(
  token: string,
  model: string,
  systemPrompt: string,
  userMessages: Array<{ role: string; content: unknown }>,
): Promise<{ response: Response; isAnthropic: boolean }> {
  if (isClaudeModel(model)) {
    const opus4 = isOpus4Model(model);
    const requestBody: Record<string, unknown> = {
      model,
      system: systemPrompt,
      messages: userMessages.filter((m) => m.role !== "system"),
      stream: true,
      max_tokens: opus4 ? 16000 : 8192,
    };
    // Opus 4.x requires extended thinking; budget_tokens must be < max_tokens
    if (opus4) {
      requestBody.thinking = { type: "enabled", budget_tokens: 8000 };
    }
    const res = await fetch(API_BASE_MESSAGES, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    return { response: res, isAnthropic: true };
  } else {
    const messages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...userMessages]
      : userMessages;
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    return { response: res, isAnthropic: false };
  }
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

Return ONLY the rewritten prompt as a plain string — no JSON, no markdown, no explanation.`;

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

    // ── MEMORY SEARCH ─────────────────────────────────────────────────────────
    } else if (mode === "memory_search") {
      const { query, taskSummaries } = body;

      if (!taskSummaries || taskSummaries.length === 0) {
        return new Response(JSON.stringify({ ids: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const summaryList = taskSummaries
        .map((s: { id: string; summary: string }) => `ID: ${s.id}\nSummary: ${s.summary}`)
        .join("\n\n---\n\n");

      const prompt = `You are a memory retrieval agent. Given a new task goal, identify which of the following past session summaries are most relevant and useful as context.

New goal: "${query}"

Past sessions:
${summaryList}

Return ONLY a JSON array of the most relevant session IDs (up to 3). If none are relevant, return [].
Example: ["id1", "id2"]`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Memory search LLM error");

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      let ids = [];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        ids = JSON.parse(cleaned);
        if (!Array.isArray(ids)) ids = [];
      } catch { ids = []; }

      return new Response(JSON.stringify({ ids: ids.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── MEMORY SUMMARIZE ──────────────────────────────────────────────────────
    } else if (mode === "memory_summarize") {
      const { taskOutputsToSummarize } = body;

      const outputText = Object.entries(taskOutputsToSummarize || {})
        .map(([id, output]) => `Task ${id}:\n${(output as string).substring(0, 800)}`)
        .join("\n\n---\n\n");

      const prompt = `Summarize the following AI agent session in 2-3 sentences. Focus on: what was accomplished, key outputs or code produced, and any important decisions made.

Goal: ${goal}
Outputs:
${outputText}

Return ONLY the summary as a plain string.`;

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${AI_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: UTILITY_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Memory summarize LLM error");

      const data = await response.json();
      const summary = (data.choices?.[0]?.message?.content || "").trim();
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── CHAT (Q&A mode) ───────────────────────────────────────────────────────
    } else if (mode === "chat") {
      const chatMessages = messages && messages.length > 0
        ? messages
        : [{ role: "user", content: goal }];

      const chatSystemPrompt = "You are a knowledgeable, helpful assistant. Answer clearly and accurately. Use markdown formatting (headers, bullet points, code blocks) when it aids readability.";

      const { response, isAnthropic } = await callLLMStream(
        AI_API_TOKEN,
        primaryModel,
        chatSystemPrompt,
        chatMessages,
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Chat LLM error: ${text}`);
      }

      const responseBody = isAnthropic
        ? translateAnthropicToOpenAI(response.body!)
        : response.body!;

      return new Response(responseBody, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });

    // ── PLAN ─────────────────────────────────────────────────────────────────
    } else if (mode === "plan") {
      const planSystemPrompt = getPlanSystemPrompt(outputMode, evolutionContext);
      const content = await callLLMNonStream(AI_API_TOKEN, primaryModel, planSystemPrompt, `Goal: ${goal}`);

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

      const taskTools: string[] | undefined = task?.tools;
      const execSystemPrompt = getExecuteSystemPrompt(outputMode, taskTools, evolutionContext);

      const { response, isAnthropic } = await callLLMStream(
        AI_API_TOKEN,
        primaryModel,
        execSystemPrompt,
        [{ role: "user", content: userPrompt }],
      );

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

      const responseBody = isAnthropic
        ? translateAnthropicToOpenAI(response.body!)
        : response.body!;

      return new Response(responseBody, {
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
