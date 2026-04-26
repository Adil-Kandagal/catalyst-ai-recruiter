import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { generateGeminiResponse } from "@/src/lib/gemini";

type ParsedJobDescription = {
  job_title: string;
  required_skills: string[];
  minimum_experience: string;
  role_summary: string;
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

type CandidateMatch = {
  candidate_id: string;
  match_score_out_of_100: number;
  match_explanation: string;
};

function isParsedJobDescription(value: unknown): value is ParsedJobDescription {
  if (!value || typeof value !== "object") return false;
  const jd = value as Record<string, unknown>;

  return (
    typeof jd.job_title === "string" &&
    Array.isArray(jd.required_skills) &&
    jd.required_skills.every((skill) => typeof skill === "string") &&
    typeof jd.minimum_experience === "string" &&
    typeof jd.role_summary === "string"
  );
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

function isValidMatchArray(value: unknown): value is CandidateMatch[] {
  if (!Array.isArray(value) || value.length !== 5) return false;

  return value.every((match) => {
    if (!match || typeof match !== "object") return false;
    const m = match as Record<string, unknown>;

    return (
      typeof m.candidate_id === "string" &&
      typeof m.match_score_out_of_100 === "number" &&
      m.match_score_out_of_100 >= 0 &&
      m.match_score_out_of_100 <= 100 &&
      typeof m.match_explanation === "string" &&
      m.match_explanation.trim().length > 0
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedJd = (body as { parsed_jd?: unknown })?.parsed_jd ?? body;

    if (!isParsedJobDescription(parsedJd)) {
      return NextResponse.json(
        {
          error:
            "Request body must contain parsed JD JSON with job_title, required_skills, minimum_experience, and role_summary.",
        },
        { status: 400 }
      );
    }

    const candidates = await getCandidates();

    const systemPrompt = [
      "You are a senior technical recruiter.",
      "Given a parsed job description and candidate profiles, rank the top 5 best-fit candidates.",
      "Return ONLY valid JSON as an array of exactly 5 objects.",
      "Each object must contain only: candidate_id (string), match_score_out_of_100 (number), match_explanation (string).",
      "match_explanation must be one sentence.",
      "Use candidate IDs exactly as provided.",
      "Sort by match_score_out_of_100 descending.",
      "Do not include markdown, code fences, or extra fields.",
    ].join(" ");

    const userPrompt = JSON.stringify(
      {
        parsed_job_description: parsedJd,
        candidates,
      },
      null,
      2
    );

    const { data } = await generateGeminiResponse<CandidateMatch[]>({
      systemPrompt,
      userPrompt,
      expectJson: true,
    });

    if (!isValidMatchArray(data)) {
      return NextResponse.json(
        { error: "LLM response did not match the required top-5 match schema." },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate candidate matches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
