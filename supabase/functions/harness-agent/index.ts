const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENTER_API_BASE_URL = Deno.env.get("ENTER_API_BASE_URL") || "";
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_8f02c91ef078");

    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const { mode, goal, task, context } = await req.json();

    if (mode === "plan") {
      // Non-streaming: decompose goal into tasks
      const response = await fetch(`${ENTER_API_BASE_URL}/code/api/v1/ai/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "z-ai/glm-5.1",
          messages: [
            {
              role: "system",
              content: `You are a precise task planning agent. Given a goal, decompose it into 3-6 concrete, actionable sub-tasks.
Return ONLY a valid JSON array with no markdown fences, no explanation, no extra text. Use this exact format:
[{"id":1,"title":"Short Task Title","description":"One or two sentences describing what this task involves."},{"id":2,...}]`,
            },
            {
              role: "user",
              content: `Goal: ${goal}`,
            },
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

      let tasks = [];
      try {
        // Strip markdown code fences if present
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        tasks = JSON.parse(cleaned);
      } catch {
        throw new Error("Failed to parse task plan from AI response");
      }

      return new Response(JSON.stringify({ tasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (mode === "execute") {
      // Streaming: execute a specific task
      const contextSection =
        context && context.length > 0
          ? `\n\nContext from previously completed tasks:\n${context.join("\n\n")}`
          : "";

      const response = await fetch(`${ENTER_API_BASE_URL}/code/api/v1/ai/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "z-ai/glm-5.1",
          messages: [
            {
              role: "system",
              content: `You are a skilled execution agent. Your job is to carry out assigned tasks thoroughly and produce high-quality, detailed outputs. Be specific, practical, and thorough. Use clear structure with headers and bullet points where helpful.`,
            },
            {
              role: "user",
              content: `Overall Goal: ${goal}

Current Task to Execute:
Title: ${task.title}
Description: ${task.description}${contextSection}

Please execute this task completely and provide detailed, actionable output.`,
            },
          ],
          stream: true,
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

        const errorSSE = `event: error\ndata: ${JSON.stringify({
          error: { message: errorMessage, type: "api_error" },
        })}\n\n`;

        return new Response(errorSSE, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
  } catch (error) {
    const errorSSE = `event: error\ndata: ${JSON.stringify({
      error: { message: error.message, type: "api_error" },
    })}\n\n`;

    return new Response(errorSSE, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }
});
