const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AGENT_WORLD_BASE = "https://world.coze.site";
const LLM_API = "https://api.enter.pro/code/api/v1/ai/chat/completions";
const CHALLENGE_SOLVER_MODEL = "z-ai/glm-5.1";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function solveChallengeWithLLM(
  challengeText: string,
  aiToken: string
): Promise<string> {
  const prompt = `You are solving an obfuscated math word problem. The text may contain:
- Random letter casing (e.g. "tHiRtY" means "thirty")
- Noise symbols (], ^, *, |, ~, /, [) and invisible zero-width characters — ignore them
- Unicode homoglyphs: Cyrillic/Greek letters that visually resemble Latin letters — read by visual shape, not encoding
- Non-standard number expressions: "a dozen"=12, "half a hundred"=50, "a score"=20, "three score"=60, "a gross"=144
- Mixed forms: "forty-3"=43, "thirty plus seven"=37, "two dozen"=24

Read the SEMANTIC meaning of the problem, perform the arithmetic, and return ONLY the final numeric answer as a plain integer or decimal. No words, no punctuation, no explanation — just the number.

Challenge: ${challengeText}`;

  const res = await fetch(LLM_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHALLENGE_SOLVER_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM error: ${res.status}`);
  }

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || "").trim();
  // Extract the first number (integer or decimal) from the response
  const match = raw.match(/[-]?\d+(\.\d+)?/);
  if (!match) throw new Error(`LLM could not extract a number from: ${raw}`);
  return match[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_TOKEN = Deno.env.get("AI_API_TOKEN_8f02c91ef078");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AI_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
      return jsonResponse({ success: false, error: "Server configuration error" }, 500);
    }

    const body = await req.json();
    const { mode } = body;

    // ── REGISTER ─────────────────────────────────────────────────────────────
    if (mode === "register") {
      const { userId, username, nickname, bio } = body;

      if (!userId || !username) {
        return jsonResponse({ success: false, error: "userId and username are required" }, 400);
      }

      // Step 1: Register with Agent World
      const regRes = await fetch(`${AGENT_WORLD_BASE}/api/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nickname: nickname || username, bio: bio || "" }),
      });
      const regData = await regRes.json();

      if (!regData.success) {
        return jsonResponse({
          success: false,
          error: regData.message || "Registration failed",
          step: "register",
        });
      }

      const { api_key, verification } = regData.data;
      const { verification_code, challenge_text } = verification;

      // Step 2: Solve the obfuscated challenge with LLM
      let answer: string;
      try {
        answer = await solveChallengeWithLLM(challenge_text, AI_TOKEN);
      } catch (e) {
        return jsonResponse({
          success: false,
          error: `Challenge solving failed: ${e.message}`,
          step: "solve",
        });
      }

      // Step 3: Verify the answer
      const verifyRes = await fetch(`${AGENT_WORLD_BASE}/api/agents/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_code, answer }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        return jsonResponse({
          success: false,
          error: verifyData.message || "Verification failed",
          step: "verify",
          attemptsRemaining: verifyData.data?.attempts_remaining,
        });
      }

      // Step 4: Persist api_key and username to profiles table
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            agent_world_username: username,
            agent_world_api_key: api_key,
          }),
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return jsonResponse({
          success: false,
          error: `Failed to save credentials: ${errText}`,
          step: "save",
        });
      }

      return jsonResponse({
        success: true,
        username,
        api_key,
        message: "Successfully joined Agent World!",
      });
    }

    // ── PROFILE ───────────────────────────────────────────────────────────────
    if (mode === "profile") {
      const { username } = body;
      if (!username) {
        return jsonResponse({ success: false, error: "username is required" }, 400);
      }

      const profileRes = await fetch(
        `${AGENT_WORLD_BASE}/api/agents/profile/${encodeURIComponent(username)}`
      );
      const profileData = await profileRes.json();

      return jsonResponse(profileData);
    }

    return jsonResponse({ success: false, error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
});
