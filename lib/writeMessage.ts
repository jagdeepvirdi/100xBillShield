import Anthropic from "@anthropic-ai/sdk";
import { geminiGenerate, withFallback } from "@/lib/llm";
import { templateMessage, type Fact } from "@/lib/message";
import { verifyMessage } from "@/lib/verifyMessage";

export type Tone = "polite" | "firm" | "friendly";

const fmt = (n: number) => n.toFixed(2);

function buildPrompt(label: string, fact: Fact, tone: Tone, rejected: number[]): string {
  const figures = [
    fact.expected !== null && `- expected: ${fmt(fact.expected)}`,
    fact.actual !== null && `- actual: ${fmt(fact.actual)}`,
    fact.difference !== null && `- difference: ${fmt(Math.abs(fact.difference))}`,
  ].filter(Boolean);

  return [
    "You write a short message from a customer to a company about one line on a bill.",
    `Tone: ${tone}.`,
    `The line: "${label}"`,
    "The check result. Every number is already computed; copy them exactly as written:",
    `- check: ${fact.rule}`,
    ...figures,
    `- result: ${fact.verdict} ("wrong" means the bill contradicts the promise or the maths; "unexplained" means the maths adds up but the line is new or changed and no reason was given)`,
    "Rules:",
    '- 3 to 5 short sentences, under 90 words, plain text, starting with "Hello," and ending with "Thank you".',
    "- Use only the numbers above, written exactly as shown. Do not add, subtract, round or compute anything.",
    "- Do not write any other number: no dates, percentages, account numbers or phone numbers.",
    "- Do not invent reasons or facts. Ask the company to correct or explain this line.",
    "- Reply with the message text only.",
    rejected.length
      ? `Your previous draft used numbers that are not allowed: ${rejected.join(", ")}. Use only the numbers above.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function askClaude(prompt: string): Promise<string> {
  const response = await new Anthropic().messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`Model stopped early (${response.stop_reason}).`);
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Model returned no text.");
  return text.text;
}

// The model only words the message. Code verifies every number: regenerate once, then use the code template.
export async function writeMessage(
  label: string,
  fact: Fact,
  tone: Tone,
): Promise<{ text: string; source: "llm" | "template" }> {
  let rejected: number[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildPrompt(label, fact, tone, rejected);
    try {
      const text = (await withFallback(() => askClaude(prompt), () => geminiGenerate([{ text: prompt }]))).trim();
      const verdict = verifyMessage(text, [fact], label);
      if (verdict.ok) return { text, source: "llm" };
      rejected = verdict.unknown;
      console.warn("message draft rejected, numbers not in the check results:", verdict.unknown);
    } catch (error) {
      console.error("message draft failed", error);
    }
  }
  return { text: templateMessage(label, fact), source: "template" };
}
