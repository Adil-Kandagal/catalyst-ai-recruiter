import { NextResponse } from "next/server";

import { generateGeminiResponse } from "@/src/lib/gemini";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type InterestScoreResult = {
  interest_score_out_of_100: number;
  interest_summary: string;
};

type ScoreInterestRequestBody = {
  messages: ChatMessage[];
};

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value)) return false;

  return value.every((message) => {
    if (!message || typeof message !== "object") return false;
    const m = message as Record<string, unknown>;

    return (
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
    );
  });
}

function isValidInterestScoreResult(value: unknown): value is InterestScoreResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;

  return (
    typeof result.interest_score_out_of_100 === "number" &&
    result.interest_score_out_of_100 >= 0 &&
    result.interest_score_out_of_100 <= 100 &&
    typeof result.interest_summary === "string" &&
    result.interest_summary.trim().length > 0
  );
}

function formatConversation(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return "No prior conversation.";
  }

  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ScoreInterestRequestBody>;
    const messages = body.messages;

    if (!isChatMessageArray(messages)) {
      return NextResponse.json(
        {
          error:
            "Request body must include messages (array of { role: user|assistant, content: string }).",
        },
        { status: 400 }
      );
    }

    const systemPrompt = [
      "You are an expert recruiting analyst.",
      "Evaluate the candidate's enthusiasm and engagement level from the full chat transcript.",
      "Return ONLY valid JSON with exactly these keys:",
      "interest_score_out_of_100 (number), interest_summary (string).",
      "interest_summary must be exactly one sentence.",
      "Do not include markdown, code fences, or extra fields.",
    ].join(" ");

    const userPrompt = [
      "Full chat transcript:",
      formatConversation(messages),
      "",
      "Score the candidate's interest and summarize your reasoning.",
    ].join("\n");

    const { data } = await generateGeminiResponse<InterestScoreResult>({
      systemPrompt,
      userPrompt,
      expectJson: true,
    });

    if (!isValidInterestScoreResult(data)) {
      return NextResponse.json(
        { error: "LLM response did not match the required interest score schema." },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to score candidate interest.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
