"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { learnFetch, learnPost } from "@/lib/learn-fetch";

interface Choice { id: string; text: string }
interface Question { id: string; text: string; type: "single" | "multiple"; score: number; choices: Choice[] }
interface Attempt { id: string; submittedAt: string; score: number; maxScore: number; percent: number; passed: boolean }
interface Quiz {
  id: string; title: string; description: string | null;
  passPercent: number; timeLimit: number; maxAttempts: number;
  questionCount: number; totalScore: number;
  questions: Question[]; attempts: Attempt[];
  bestPercent: number; passed: boolean; canAttempt: boolean;
}
interface ResultItem {
  questionId: string; text: string; correct: boolean;
  pickedIds: string[]; correctIds: string[];
  explanation: string | null; score: number; maxScore: number;
}
interface Result {
  score: number; maxScore: number; percent: number; passed: boolean;
  passPercent: number; results: ResultItem[]; certificateCode: string | null;
}

const LETTERS = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ"];

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function QuizRunner({ lessonId, onPassed }: { lessonId: string; onPassed?: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submitRef = useRef<() => void>(() => {});

  const load = useCallback(() =>
    learnFetch(`/learn/quizzes/${lessonId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "โหลดแบบทดสอบไม่ได้");
        return d as Quiz;
      })
      .then(setQuiz)
      .catch((e) => setError(e.message)), [lessonId]);

  useEffect(() => { load(); }, [load]);

  // นับเวลาถอยหลัง — หมดเวลาแล้วส่งอัตโนมัติ
  useEffect(() => {
    if (secondsLeft === null || result) return;
    // หมดเวลา: ส่งใน timeout เพื่อไม่ให้เปลี่ยน state ระหว่าง effect กำลังรัน
    const t = setTimeout(
      () => (secondsLeft <= 0 ? submitRef.current() : setSecondsLeft((s) => (s === null ? null : s - 1))),
      secondsLeft <= 0 ? 0 : 1000
    );
    return () => clearTimeout(t);
  }, [secondsLeft, result]);

  const start = async () => {
    setError("");
    try {
      const res = await learnPost(`/learn/quizzes/${lessonId}/attempts`, {});
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "เริ่มทำข้อสอบไม่ได้");
      setAttemptId(d.attemptId);
      setAnswers({});
      setResult(null);
      setSecondsLeft(d.timeLimit > 0 ? d.timeLimit * 60 : null);
      await load(); // สลับลำดับข้อใหม่ทุกครั้งที่เริ่ม
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pick = (question: Question, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      if (question.type === "single") return { ...prev, [question.id]: [choiceId] };
      return {
        ...prev,
        [question.id]: current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId],
      };
    });
  };

  const submit = async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await learnPost(`/learn/attempts/${attemptId}/submit`, {
        answers: Object.entries(answers).map(([questionId, choiceIds]) => ({ questionId, choiceIds })),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "ส่งคำตอบไม่สำเร็จ");
      setResult(d);
      setSecondsLeft(null);
      setAttemptId(null);
      await load();
      if (d.passed) onPassed?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ให้ตัวจับเวลาเรียก submit ตัวล่าสุดได้โดยไม่ต้องผูกเป็น dependency
  useEffect(() => { submitRef.current = submit; });

  if (error && !quiz) return <p className="text-sm" style={{ color: "var(--lms-red)" }}>{error}</p>;
  if (!quiz) return <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลดแบบทดสอบ...</p>;

  const card = { background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" };

  /* ---------------- หน้าผลสอบ ---------------- */
  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-6 text-center" style={card}>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: result.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
            <svg className="h-7 w-7" style={{ color: result.passed ? "var(--lms-green)" : "var(--lms-red)" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={result.passed ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
            </svg>
          </div>
          <h3 className="text-lg font-bold">{result.passed ? "ผ่านแล้ว" : "ยังไม่ผ่าน"}</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--lms-accent-text)" }}>
            {result.percent}%
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--lms-text-muted)" }}>
            ได้ {result.score} จาก {result.maxScore} คะแนน · เกณฑ์ผ่าน {result.passPercent}%
          </p>

          {result.certificateCode && (
            <div className="mt-4 rounded-lg p-3" style={{ background: "var(--lms-accent-bg)" }}>
              <p className="text-sm" style={{ color: "var(--lms-accent-text)" }}>
                🎉 คุณเรียนจบคอร์สนี้แล้ว ได้รับเกียรติบัตร
              </p>
              <Link href={`/learn/certificates/${result.certificateCode}`}
                className="mt-2 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-black"
                style={{ background: "var(--lms-accent)" }}>
                ดูเกียรติบัตร
              </Link>
            </div>
          )}

          {!result.passed && quiz.canAttempt && (
            <button onClick={start} className="mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold text-black"
              style={{ background: "var(--lms-accent)" }}>
              ทำใหม่อีกครั้ง
            </button>
          )}
        </div>

        <div className="space-y-3">
          {result.results.map((r, i) => (
            <div key={r.questionId} className="rounded-xl p-4" style={card}>
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-sm" style={{ color: r.correct ? "var(--lms-green)" : "var(--lms-red)" }}>
                  {r.correct ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">ข้อ {i + 1}. {r.text}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--lms-text-muted)" }}>
                    ได้ {r.score}/{r.maxScore} คะแนน
                  </p>
                  {!r.correct && (
                    <p className="mt-1 text-xs" style={{ color: "var(--lms-text-secondary)" }}>
                      คำตอบที่ถูก: {quiz.questions.find((q) => q.id === r.questionId)?.choices
                        .filter((c) => r.correctIds.includes(c.id)).map((c) => c.text).join(" · ") || "—"}
                    </p>
                  )}
                  {r.explanation && (
                    <p className="mt-2 rounded-lg p-2 text-xs" style={{ background: "var(--lms-bg-input)", color: "var(--lms-text-secondary)" }}>
                      💡 {r.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- หน้าทำข้อสอบ ---------------- */
  if (attemptId) {
    const answered = Object.values(answers).filter((a) => a.length > 0).length;
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl px-4 py-3 backdrop-blur-md"
          style={{ ...card, background: "var(--lms-topbar)" }}>
          <span className="text-sm" style={{ color: "var(--lms-text-secondary)" }}>
            ตอบแล้ว {answered}/{quiz.questions.length} ข้อ
          </span>
          {secondsLeft !== null && (
            <span className="text-sm font-semibold tabular-nums"
              style={{ color: secondsLeft <= 60 ? "var(--lms-red)" : "var(--lms-accent-text)" }}>
              เหลือ {mmss(secondsLeft)}
            </span>
          )}
        </div>

        {quiz.questions.map((question, i) => (
          <div key={question.id} className="rounded-xl p-4" style={card}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm font-medium">ข้อ {i + 1}. {question.text}</p>
              <span className="shrink-0 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                {question.score} คะแนน{question.type === "multiple" ? " · เลือกได้หลายข้อ" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {question.choices.map((choice, ci) => {
                const picked = (answers[question.id] ?? []).includes(choice.id);
                return (
                  <button key={choice.id} onClick={() => pick(question, choice.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition"
                    style={{
                      background: picked ? "var(--lms-accent-bg)" : "var(--lms-bg-input)",
                      border: `1px solid ${picked ? "var(--lms-accent)" : "var(--lms-border)"}`,
                      color: picked ? "var(--lms-accent-text)" : "var(--lms-text)",
                    }}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                      style={{ border: `1px solid ${picked ? "var(--lms-accent)" : "var(--lms-border)"}` }}>
                      {LETTERS[ci] ?? ci + 1}
                    </span>
                    {choice.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {error && <p className="text-sm" style={{ color: "var(--lms-red)" }}>{error}</p>}

        <button onClick={submit} disabled={submitting || answered === 0}
          className="w-full rounded-lg py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--lms-accent)" }}>
          {submitting ? "กำลังส่ง..." : `ส่งคำตอบ (${answered}/${quiz.questions.length} ข้อ)`}
        </button>
      </div>
    );
  }

  /* ---------------- หน้าก่อนเริ่ม ---------------- */
  return (
    <div className="rounded-xl p-6" style={card}>
      <h3 className="text-lg font-bold">{quiz.title}</h3>
      {quiz.description && (
        <p className="mt-1 text-sm" style={{ color: "var(--lms-text-muted)" }}>{quiz.description}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["จำนวนข้อ", `${quiz.questionCount} ข้อ`],
          ["คะแนนเต็ม", `${quiz.totalScore} คะแนน`],
          ["เกณฑ์ผ่าน", `${quiz.passPercent}%`],
          ["เวลา", quiz.timeLimit > 0 ? `${quiz.timeLimit} นาที` : "ไม่จำกัด"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg p-3" style={{ background: "var(--lms-bg-input)" }}>
            <dt className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{k}</dt>
            <dd className="mt-0.5 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {quiz.attempts.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs" style={{ color: "var(--lms-text-muted)" }}>
            เคยทำไปแล้ว {quiz.attempts.length} ครั้ง
            {quiz.maxAttempts > 0 ? ` (ทำได้สูงสุด ${quiz.maxAttempts} ครั้ง)` : ""} · คะแนนดีที่สุด {quiz.bestPercent}%
          </p>
          <div className="space-y-1">
            {quiz.attempts.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--lms-bg-input)" }}>
                <span style={{ color: "var(--lms-text-muted)" }}>
                  {new Date(a.submittedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span style={{ color: a.passed ? "var(--lms-green)" : "var(--lms-red)" }}>
                  {a.score}/{a.maxScore} = {a.percent}% {a.passed ? "ผ่าน" : "ไม่ผ่าน"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm" style={{ color: "var(--lms-red)" }}>{error}</p>}

      {quiz.canAttempt ? (
        <button onClick={start} className="mt-5 w-full rounded-lg py-3 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}>
          {quiz.attempts.length > 0 ? "ทำอีกครั้ง" : "เริ่มทำแบบทดสอบ"}
        </button>
      ) : (
        <p className="mt-5 rounded-lg p-3 text-center text-sm" style={{ background: "var(--lms-bg-input)", color: "var(--lms-text-muted)" }}>
          ทำครบจำนวนครั้งที่กำหนดแล้ว{quiz.passed ? " · คุณสอบผ่านแล้ว" : ""}
        </p>
      )}
    </div>
  );
}
