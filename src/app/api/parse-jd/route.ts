import { NextResponse } from "next/server";

import { generateGeminiResponse } from "../../../lib/gemini";

type ParsedJobDescription = {
  job_title: string;
  required_skills: string[];
  minimum_experience: string;
  role_summary: string;
};

function isValidParsedJobDescription(value: unknown): value is ParsedJobDescription {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.job_title === "string" &&
    Array.isArray(candidate.required_skills) &&
    candidate.required_skills.every((skill) => typeof skill === "string") &&
    typeof candidate.minimum_experience === "string" &&
    typeof candidate.role_summary === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawJobDescription =
      typeof body === "string"
        ? body.trim()
        : typeof body?.jobDescription === "string"
        ? body.jobDescription.trim()
        : "";

    if (!rawJobDescription) {
      return NextResponse.json(
        { error: "Request body must include a raw job description string." },
        { status: 400 }
      );
    }

    const systemPrompt = [
      "You extract structured hiring requirements from job descriptions.",
      "Return ONLY valid JSON with exactly these keys:",
      "job_title (string), required_skills (string[]), minimum_experience (string), role_summary (string).",
      "role_summary must be exactly 2 sentences.",
      "Do not include markdown, code fences, or extra fields.",
    ].join(" ");

    const { data } = await generateGeminiResponse<ParsedJobDescription>({
      systemPrompt,
      userPrompt: rawJobDescription,
      expectJson: true,
    });

    if (!isValidParsedJobDescription(data)) {
      return NextResponse.json(
        { error: "LLM response did not match the required schema." },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse job description.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
