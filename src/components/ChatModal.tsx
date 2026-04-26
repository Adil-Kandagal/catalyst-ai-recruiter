"use client";

import React, { FormEvent, useMemo, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type InterestScoreResult = {
  interest_score_out_of_100: number;
  interest_summary: string;
};

type ChatModalProps = {
  isOpen: boolean;
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onInterestScore?: (candidateId: string, score: InterestScoreResult) => void;
};

function getInterestBadgeClass(score: number) {
  if (score >= 75) return "border-emerald-300 bg-emerald-300";
  if (score >= 40) return "border-amber-300 bg-amber-300";
  return "border-rose-300 bg-rose-300";
}

function getInterestTextColorClass(score: number) {
  if (score >= 75) return "text-emerald-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

export default function ChatModal({ isOpen, candidateId, candidateName, onClose, onInterestScore }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [candidateDraft, setCandidateDraft] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [interestScore, setInterestScore] = useState<InterestScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(
    () => candidateDraft.trim().length > 0 && !isChatLoading && !isScoring,
    [candidateDraft, isChatLoading, isScoring]
  );

  if (!isOpen) return null;

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDraft = candidateDraft.trim();
    if (!trimmedDraft || isChatLoading || isScoring) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmedDraft }];
    setMessages(nextMessages);
    setCandidateDraft("");
    setError(null);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          messages: nextMessages,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Failed to receive recruiter response.");
      }

      setMessages((previous) => [...previous, { role: "assistant", content: payload.message as string }]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Something went wrong.");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleFinishAndScore() {
    if (messages.length === 0 || isScoring || isChatLoading) return;

    setIsScoring(true);
    setError(null);

    try {
      const response = await fetch("/api/score-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const payload = (await response.json()) as InterestScoreResult | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Failed to score interest." : "Failed to score.");
      }

      setInterestScore(payload as InterestScoreResult);
      onInterestScore?.(candidateId, payload as InterestScoreResult);
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : "Unable to score chat.");
    } finally {
      setIsScoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
        <header className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Outreach Simulation</h3>
            <p className="text-sm text-slate-400">Candidate: {candidateName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFinishAndScore}
              disabled={messages.length === 0 || isScoring || isChatLoading}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
            >
              {isScoring ? "Scoring..." : "Finish & Score"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </header>

        {interestScore && (
          <div className="border-b border-slate-700 px-5 py-3">
            <div className={`flex items-center gap-2 text-sm font-semibold ${getInterestTextColorClass(
              interestScore.interest_score_out_of_100
            )}`}>
              <span
                className={`inline-flex h-3 w-3 rounded-full border ${getInterestBadgeClass(
                  interestScore.interest_score_out_of_100
                )}`}
              />
              <span>Interest Score: {interestScore.interest_score_out_of_100}/100</span>
            </div>
            <p className="mt-1 text-sm text-slate-200/90">
              {interestScore.interest_summary}
            </p>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-400">
              Start the outreach simulation by sending the first message as the candidate.
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-indigo-500/20 text-indigo-100"
                    : "mr-auto bg-slate-800 text-slate-100"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {message.role === "user" ? "Candidate" : "Recruiter"}
                </p>
                <p>{message.content}</p>
              </div>
            ))
          )}

          {isChatLoading && (
            <div className="mr-auto max-w-[85%] rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
              Recruiter is typing...
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-slate-700 p-4">
          <label htmlFor="candidate-message" className="mb-2 block text-xs font-medium text-slate-400">
            Message as Candidate
          </label>
          <div className="flex gap-2">
            <input
              id="candidate-message"
              type="text"
              value={candidateDraft}
              onChange={(event) => setCandidateDraft(event.target.value)}
              placeholder="Type your response..."
              className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-700/60"
            >
              Send
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        </form>
      </div>
    </div>
  );
}
