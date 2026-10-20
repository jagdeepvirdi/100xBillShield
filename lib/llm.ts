import Anthropic from "@anthropic-ai/sdk";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Calls Gemini's REST API directly (no extra dependency) and returns the first text part.
export async function geminiGenerate(parts: object[], generationConfig: object = {}): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);

  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no text.");
  return text;
}

// Claude first. Gemini runs only when Claude cannot be called (no key, credits used up, rate limit, outage).
export async function withFallback<T>(claude: () => Promise<T>, gemini: () => Promise<T>): Promise<T> {
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);

  if (!process.env.ANTHROPIC_API_KEY) {
    if (!geminiAvailable) throw new Error("No LLM key is configured.");
    return gemini();
  }

  try {
    return await claude();
  } catch (error) {
    const claudeUnavailable =
      error instanceof Anthropic.APIError || error instanceof Anthropic.APIConnectionError;
    if (!claudeUnavailable || !geminiAvailable) throw error;
    console.warn("Claude unavailable, falling back to Gemini:", error.message);
    return gemini();
  }
}
