import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { generateGeminiResponse } from "@/src/lib/gemini";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CandidateProfile = {
  id: string;
  name: string;
  current_role: string;
  skills: string[];
  years_of_experience: number;
  bio: string;
  email: string;
};

type ChatRequestBody = {
  candidate_id: string;
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

function isCandidateProfileArray(value: unknown): value is CandidateProfile[] {
  if (!Array.isArray(value)) return false;

  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const c = candidate as Record<string, unknown>;

    return (
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      typeof c.current_role === "string" &&
      Array.isArray(c.skills) &&
      c.skills.every((skill) => typeof skill === "string") &&
      typeof c.years_of_experience === "number" &&
      typeof c.bio === "string" &&
      typeof c.email === "string"
    );
  });
}

async function getCandidates(): Promise<CandidateProfile[]> {
  const candidatesPath = path.join(process.cwd(), "src", "data", "candidates.json");
  const fileContents = await readFile(candidatesPath, "utf-8");
  const parsed = JSON.parse(fileContents) as unknown;

  if (!isCandidateProfileArray(parsed)) {
    throw new Error("candidates.json does not match the expected schema.");
  }

  return parsed;
}

function formatConversation(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return "No prior conversation.";
  }

  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequestBody>;
    const candidateId = typeof body.candidate_id === "string" ? body.candidate_id.trim() : "";
    const messages = body.messages;

    if (!candidateId || !isChatMessageArray(messages)) {
      return NextResponse.json(
        {
          error:
            "Request body must include candidate_id (string) and messages (array of { role: user|assistant, content: string }).",
        },
        { status: 400 }
      );
    }

    const candidates = await getCandidates();
    const candidate = candidates.find((item) => item.id === candidateId);

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const systemPrompt = [
      "You are an AI recruiter having a live chat with a candidate.",
      `The candidate is ${candidate.name}, currently a ${candidate.current_role}.`,
      "Your goal is to gauge their interest, availability, motivation, and fit for a relevant role.",
      "Ask one thoughtful follow-up question at a time, based on the conversation history.",
      "Keep responses concise, professional, and conversational.",
      "Do not use markdown or bullet points.",
    ].join(" ");

    const userPrompt = [
      "Candidate profile:",
      JSON.stringify(candidate, null, 2),
      "",
      "Conversation history:",
      formatConversation(messages),
      "",
      "Write the AI recruiter's next single message to the candidate.",
    ].join("\n");

    const { text } = await generateGeminiResponse({
      systemPrompt,
      userPrompt,
      expectJson: false,
    });

    if (!text) {
      return NextResponse.json({ error: "LLM returned an empty chat response." }, { status: 502 });
    }

    return NextResponse.json({ message: text }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate recruiter chat response.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
