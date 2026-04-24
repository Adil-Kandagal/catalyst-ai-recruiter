import { GoogleGenAI } from "@google/genai";

type GeminiCallParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  expectJson?: boolean;
};

type GeminiCallResult<T = unknown> = {
  text: string;
  data: T | null;
};

const DEFAULT_MODEL = "gemini-2.5-flash";

function cleanJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fencedMatch?.[1]?.trim() ?? trimmed;
}

/**
 * Calls Gemini with a system + user prompt and returns both plain text and parsed JSON (when requested).
 */
export async function generateGeminiResponse<T = unknown>({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
  expectJson = true,
}: GeminiCallParams): Promise<GeminiCallResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      ...(expectJson ? { responseMimeType: "application/json" } : {}),
    },
  });

  const text = response.text?.trim() ?? "";

  if (!expectJson) {
    return { text, data: null };
  }

  if (!text) {
    throw new Error("Gemini returned an empty response while JSON was expected.");
  }

  try {
    const parsed = JSON.parse(cleanJsonText(text)) as T;
    return { text, data: parsed };
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${
        error instanceof Error ? error.message : "Unknown parse error"
      }`
    );
  }
}
