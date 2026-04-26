"use client";

import React, { useMemo, useState } from "react";

import candidates from "../data/candidates.json";
import ChatModal from "../components/ChatModal";

type ParsedJD = {
  job_title: string;
  required_skills: string[];
  minimum_experience: string;
  role_summary: string;
};

type CandidateMatch = {
  candidate_id: string;
  match_score_out_of_100: number;
  match_explanation: string;
};

type InterestScoreResult = {
  interest_score_out_of_100: number;
  interest_summary: string;
};

type CandidateProfile = {
  id: string;
  name: string;
};

const candidateDirectory = candidates as CandidateProfile[];

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<CandidateProfile | null>(null);
  const [interestScores, setInterestScores] = useState<Map<string, InterestScoreResult>>(new Map());

  const candidateNameById = useMemo(() => {
    return new Map(candidateDirectory.map((candidate) => [candidate.id, candidate.name]));
  }, []);

  const handleInterestScoreUpdate = (candidateId: string, score: InterestScoreResult) => {
    setInterestScores(prev => new Map(prev.set(candidateId, score)));
  };

  const getMatchScoreBadgeColor = (score: number) => {
    if (score > 80) return "bg-green-500/20 text-green-300 border-green-500/50";
    if (score > 60) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
    return "bg-red-500/20 text-red-300 border-red-500/50";
  };

  const getInterestScoreBadgeColor = (score: number) => {
    if (score >= 75) return "bg-emerald-500/10 text-emerald-300 border-emerald-300";
    if (score >= 40) return "bg-amber-500/10 text-amber-300 border-amber-300";
    return "bg-rose-500/10 text-rose-300 border-rose-300";
  };

  const getInterestScoreDotColor = (score: number) => {
    if (score >= 75) return "bg-emerald-300";
    if (score >= 40) return "bg-amber-300";
    return "bg-rose-300";
  };

  const getOverallScore = (matchScore: number, interestScore: InterestScoreResult | undefined) => {
    if (!interestScore) return null;
    return Math.round((matchScore + interestScore.interest_score_out_of_100) / 2);
  };

  const getOverallBadgeColor = (score: number) => {
    if (score > 80) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
    if (score > 60) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
    return "bg-red-500/20 text-red-300 border-red-500/50";
  };

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aInterest = interestScores.get(a.candidate_id);
      const bInterest = interestScores.get(b.candidate_id);
      const aOverall = aInterest ? (a.match_score_out_of_100 + aInterest.interest_score_out_of_100) / 2 : -1;
      const bOverall = bInterest ? (b.match_score_out_of_100 + bInterest.interest_score_out_of_100) / 2 : -1;

      if (aOverall !== bOverall) {
        return bOverall - aOverall;
      }

      return b.match_score_out_of_100 - a.match_score_out_of_100;
    });
  }, [matches, interestScores]);

  async function handleFindCandidates() {
    const trimmedJD = jobDescription.trim();
    if (!trimmedJD) {
      setError("Please paste a job description first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedJD(null);
    setMatches([]);

    try {
      const parsedResponse = await fetch("/api/parse-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: trimmedJD }),
      });

      const parsedPayload = (await parsedResponse.json()) as ParsedJD | { error?: string };

      if (!parsedResponse.ok) {
        throw new Error(
          "error" in parsedPayload && parsedPayload.error
            ? parsedPayload.error
            : "Failed to parse the job description."
        );
      }

      const parsed = parsedPayload as ParsedJD;
      setParsedJD(parsed);

      const matchesResponse = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed_jd: parsed }),
      });

      const matchesPayload = (await matchesResponse.json()) as CandidateMatch[] | { error?: string };

      if (!matchesResponse.ok) {
        throw new Error(
          "error" in matchesPayload && matchesPayload.error
            ? matchesPayload.error
            : "Failed to find candidate matches."
        );
      }

      setMatches(matchesPayload as CandidateMatch[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight">Recruiter Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">
              Paste a job description and let AI rank the best-fit candidates.
            </p>
          </div>

          <label htmlFor="job-description" className="mb-2 block text-sm font-medium text-slate-300">
            Job Description
          </label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the full job description here..."
            className="h-[60vh] w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
          />

          <button
            type="button"
            onClick={handleFindCandidates}
            disabled={isLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-700/60"
          >
            {isLoading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isLoading ? "Finding Candidates..." : "Find Candidates"}
          </button>

          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Matches</h2>
            {isLoading && (
              <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-100" />
                Loading...
              </div>
            )}
          </div>

          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Parsed JD Summary
            </h3>
            {parsedJD ? (
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="font-semibold text-slate-100">Title:</span> {parsedJD.job_title}
                </p>
                <p>
                  <span className="font-semibold text-slate-100">Minimum Experience:</span>{" "}
                  {parsedJD.minimum_experience}
                </p>
                <p>
                  <span className="font-semibold text-slate-100">Required Skills:</span>{" "}
                  {parsedJD.required_skills.join(", ")}
                </p>
                <p className="text-slate-300">{parsedJD.role_summary}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Run a search to see parsed role details.</p>
            )}
          </div>

          <div className="space-y-3">
            {matches.length === 0 && !isLoading ? (
              <p className="text-sm text-slate-400">Top candidates will appear here.</p>
            ) : (
              sortedMatches.map((match) => {
                const interestScore = interestScores.get(match.candidate_id);
                const overallScore = getOverallScore(match.match_score_out_of_100, interestScore);
                return (
                  <article
                    key={match.candidate_id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-100">
                          {candidateNameById.get(match.candidate_id) ?? match.candidate_id}
                        </h4>
                        <div className="mt-2 flex gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getMatchScoreBadgeColor(match.match_score_out_of_100)}`}>
                            Match: {match.match_score_out_of_100}/100
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold ${
                            interestScore
                              ? getInterestScoreBadgeColor(interestScore.interest_score_out_of_100)
                              : "border-slate-600/50 bg-slate-800/50 text-slate-400"
                          }`}>
                            {interestScore ? (
                              <>
                                <span
                                  className={`inline-flex h-2.5 w-2.5 rounded-full ${getInterestScoreDotColor(
                                    interestScore.interest_score_out_of_100
                                  )}`}
                                />
                                Interest: {interestScore.interest_score_out_of_100}/100
                              </>
                            ) : (
                              "Interest: Pending"
                            )}
                          </span>
                          {overallScore !== null && (
                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getOverallBadgeColor(overallScore)}`}>
                              Overall: {overallScore}/100
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{match.match_explanation}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCandidate({
                            id: match.candidate_id,
                            name: candidateNameById.get(match.candidate_id) ?? match.candidate_id,
                          })
                        }
                        className="shrink-0 rounded-lg border border-indigo-400/50 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
                      >
                        Simulate Outreach
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          </section>
        </div>
      </main>

      <ChatModal
        isOpen={Boolean(activeCandidate)}
        candidateId={activeCandidate?.id ?? ""}
        candidateName={activeCandidate?.name ?? ""}
        onClose={() => setActiveCandidate(null)}
        onInterestScore={handleInterestScoreUpdate}
      />
    </>
  );
}
