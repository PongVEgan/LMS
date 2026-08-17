"use client";

import { useCallback, useEffect, useState } from "react";
import { adminDelete, adminGet, adminJson, adminPost, adminPut } from "@/lib/admin-fetch";

interface EditorChoice { text: string; isCorrect: boolean }
interface EditorQuestion {
  id: string; text: string; type: "single" | "multiple";
  score: number; explanation: string | null; choices: (EditorChoice & { id: string })[];
}
interface QuizData {
  id: string; title: string; description: string | null;
  passPercent: number; timeLimit: number; maxAttempts: number; shuffle: boolean;
  questions: EditorQuestion[];
  stats: { attempts: number; passed: number; avgPercent: number };
}

const EMPTY_CHOICES: EditorChoice[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
];

export default function QuizEditor({ lessonId }: { lessonId: string }) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() =>
    adminGet(`/lessons/${lessonId}/quiz`)
      .then(adminJson<QuizData | null>)
      .then(setQuiz)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false)), [lessonId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<Response>) => {
    setError("");
    try {
      await adminJson(await fn());
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลดแบบทดสอบ...</p>;

  const card = { background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" };

  if (!quiz) {
    return (
      <div className="rounded-lg p-4 text-center" style={{ border: "1px dashed var(--lms-border)" }}>
        <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>บทเรียนนี้ยังไม่มีแบบทดสอบ</p>
        <button type="button" onClick={() => run(() => adminPut(`/lessons/${lessonId}/quiz`, { title: "แบบทดสอบ" }))}
          className="mt-2 rounded-lg px-4 py-2 text-xs font-semibold text-black" style={{ background: "var(--lms-accent)" }}>
          สร้างแบบทดสอบ
        </button>
        {error && <p className="mt-2 text-xs" style={{ color: "var(--lms-red)" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs" style={{ color: "var(--lms-red)" }}>{error}</p>}

      {/* ตั้งค่าชุดข้อสอบ */}
      <div className="space-y-2 rounded-lg p-3" style={card}>
        <input defaultValue={quiz.title}
          onBlur={(e) => e.target.value !== quiz.title && run(() => adminPut(`/lessons/${lessonId}/quiz`, { title: e.target.value }))}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium lms-input" />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["passPercent", "เกณฑ์ผ่าน (%)", quiz.passPercent],
            ["timeLimit", "เวลา (นาที, 0=ไม่จำกัด)", quiz.timeLimit],
            ["maxAttempts", "ทำได้กี่ครั้ง (0=ไม่จำกัด)", quiz.maxAttempts],
          ] as const).map(([key, label, value]) => (
            <div key={key}>
              <label className="mb-1 block text-[10px]" style={{ color: "var(--lms-text-faint)" }}>{label}</label>
              <input type="number" min="0" defaultValue={value}
                onBlur={(e) => Number(e.target.value) !== value && run(() => adminPut(`/lessons/${lessonId}/quiz`, { [key]: Number(e.target.value) }))}
                className="w-full rounded-lg px-2 py-1.5 text-sm lms-input" />
            </div>
          ))}
          <label className="flex items-end gap-2 pb-1.5 text-xs" style={{ color: "var(--lms-text-muted)" }}>
            <input type="checkbox" checked={quiz.shuffle}
              onChange={(e) => run(() => adminPut(`/lessons/${lessonId}/quiz`, { shuffle: e.target.checked }))} />
            สลับข้อ
          </label>
        </div>

        {quiz.stats.attempts > 0 && (
          <p className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
            มีผู้ทำแล้ว {quiz.stats.attempts} ครั้ง · ผ่าน {quiz.stats.passed} ครั้ง · คะแนนเฉลี่ย {quiz.stats.avgPercent}%
          </p>
        )}
      </div>

      {/* คำถาม */}
      {quiz.questions.map((question, i) =>
        editing === question.id ? (
          <QuestionForm key={question.id} question={question} onCancel={() => setEditing(null)}
            onSave={async (body) => { await run(() => adminPut(`/questions/${question.id}`, body)); setEditing(null); }} />
        ) : (
          <div key={question.id} className="rounded-lg p-3" style={card}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm">
                <span style={{ color: "var(--lms-text-faint)" }}>{i + 1}. </span>{question.text}
              </p>
              <div className="flex shrink-0 gap-2 text-xs">
                <span style={{ color: "var(--lms-text-faint)" }}>{question.score} คะแนน</span>
                <button type="button" onClick={() => setEditing(question.id)} className="hover:underline" style={{ color: "var(--lms-accent-text)" }}>แก้ไข</button>
                <button type="button" onClick={() => confirm("ลบคำถามนี้?") && run(() => adminDelete(`/questions/${question.id}`))}
                  className="hover:underline" style={{ color: "var(--lms-red)" }}>ลบ</button>
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {question.choices.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs"
                  style={{ color: c.isCorrect ? "var(--lms-green)" : "var(--lms-text-muted)" }}>
                  <span>{c.isCorrect ? "✓" : "○"}</span>{c.text}
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {adding ? (
        <QuestionForm onCancel={() => setAdding(false)}
          onSave={async (body) => { await run(() => adminPost(`/quizzes/${quiz.id}/questions`, body)); setAdding(false); }} />
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full rounded-lg py-2 text-xs transition hover:opacity-80"
          style={{ border: "1px dashed var(--lms-border)", color: "var(--lms-text-muted)" }}>
          + เพิ่มคำถาม
        </button>
      )}

      <button type="button"
        onClick={() => confirm("ลบแบบทดสอบทั้งชุด รวมคำถามและประวัติการทำของผู้เรียน?") && run(() => adminDelete(`/lessons/${lessonId}/quiz`))}
        className="text-xs hover:underline" style={{ color: "var(--lms-red)" }}>
        ลบแบบทดสอบทั้งชุด
      </button>
    </div>
  );
}

function QuestionForm({ question, onSave, onCancel }: {
  question?: EditorQuestion;
  onSave: (body: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question?.text ?? "");
  const [type, setType] = useState<"single" | "multiple">(question?.type ?? "single");
  const [score, setScore] = useState(String(question?.score ?? 1));
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [choices, setChoices] = useState<EditorChoice[]>(
    question?.choices.map((c) => ({ text: c.text, isCorrect: c.isCorrect })) ?? EMPTY_CHOICES
  );

  const toggleCorrect = (index: number) =>
    setChoices((prev) =>
      prev.map((c, i) =>
        // เลือกคำตอบเดียว = ติ๊กข้อใหม่แล้วข้ออื่นต้องหลุด
        type === "single" ? { ...c, isCorrect: i === index } : i === index ? { ...c, isCorrect: !c.isCorrect } : c
      )
    );

  const filled = choices.filter((c) => c.text.trim());
  const valid = text.trim() && filled.length >= 2 && filled.some((c) => c.isCorrect);

  return (
    <div className="space-y-2 rounded-lg p-3" style={{ background: "var(--lms-bg-input)", border: "1px solid var(--lms-accent)" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="คำถาม"
        className="w-full rounded-lg px-3 py-2 text-sm lms-input" />

      <div className="grid grid-cols-2 gap-2">
        <select value={type}
          onChange={(e) => {
            const next = e.target.value as "single" | "multiple";
            setType(next);
            // สลับกลับมาเลือกข้อเดียว ต้องเหลือคำตอบถูกแค่ข้อเดียว
            if (next === "single") {
              const first = choices.findIndex((c) => c.isCorrect);
              setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === first })));
            }
          }}
          className="rounded-lg px-3 py-2 text-sm lms-input">
          <option value="single">เลือกคำตอบเดียว</option>
          <option value="multiple">เลือกได้หลายข้อ</option>
        </select>
        <input type="number" min="1" value={score} onChange={(e) => setScore(e.target.value)}
          placeholder="คะแนน" className="rounded-lg px-3 py-2 text-sm lms-input" />
      </div>

      <div className="space-y-1.5">
        {choices.map((choice, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => toggleCorrect(i)} title="ตั้งเป็นคำตอบที่ถูก"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
              style={{
                border: `1px solid ${choice.isCorrect ? "var(--lms-green)" : "var(--lms-border)"}`,
                background: choice.isCorrect ? "rgba(34,197,94,0.12)" : "transparent",
                color: choice.isCorrect ? "var(--lms-green)" : "var(--lms-text-faint)",
              }}>
              {choice.isCorrect ? "✓" : "○"}
            </button>
            <input value={choice.text}
              onChange={(e) => setChoices((prev) => prev.map((c, ci) => (ci === i ? { ...c, text: e.target.value } : c)))}
              placeholder={`ตัวเลือกที่ ${i + 1}`} className="flex-1 rounded-lg px-3 py-1.5 text-sm lms-input" />
            {choices.length > 2 && (
              <button type="button" onClick={() => setChoices((prev) => prev.filter((_, ci) => ci !== i))}
                className="shrink-0 text-xs" style={{ color: "var(--lms-red)" }}>✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setChoices((prev) => [...prev, { text: "", isCorrect: false }])}
          className="text-[11px] hover:underline" style={{ color: "var(--lms-accent-text)" }}>
          + เพิ่มตัวเลือก
        </button>
      </div>

      <input value={explanation} onChange={(e) => setExplanation(e.target.value)}
        placeholder="คำอธิบายเฉลย (ไม่บังคับ — โชว์หลังผู้เรียนส่งคำตอบ)"
        className="w-full rounded-lg px-3 py-2 text-sm lms-input" />

      {!valid && (
        <p className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
          ต้องมีคำถาม ตัวเลือกอย่างน้อย 2 ข้อ และเลือกคำตอบที่ถูกอย่างน้อย 1 ข้อ
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={!valid}
          onClick={() => onSave({
            text: text.trim(),
            type,
            score: Number(score) || 1,
            explanation: explanation.trim() || null,
            choices: filled,
          })}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          style={{ background: "var(--lms-accent)" }}>
          บันทึกคำถาม
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-1.5 text-sm"
          style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
