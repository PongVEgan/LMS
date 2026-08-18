"use client";

import { learnFetch, learnPost, LMS_API } from "@/lib/learn-fetch";
import { getYouTubeId } from "@/lib/video";
import YouTubePlayer from "@/components/YouTubePlayer";
import QuizRunner from "@/components/QuizRunner";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";


// วิดีโอบทเรียนรองรับเฉพาะลิงก์ YouTube เท่านั้น (ดู src/lib/video.ts)

interface LessonDetail {
  id: string;
  chapterId: string;
  courseId: string;
  title: string;
  description: string | null;
  type: string;
  content: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  isFree: boolean;
  attachments: { id: string; url: string; name: string; size: number }[];
  progress?: { completed: boolean; position: number; watchedPercent: number };
}

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [watchedPercent, setWatchedPercent] = useState(0);
  // กันยิงซ้ำตอนข้ามเกณฑ์ 90% — บันทึกครั้งเดียวพอ
  const autoCompletedRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email) return;
    setLoading(true);
    setCompleted(false);

    const email = session.user.email;

    autoCompletedRef.current = false;
    setWatchedPercent(0);

    learnFetch(`/learn/lessons/${lessonId}`)
      .then((res) => {
        if (!res.ok) throw new Error("ไม่สามารถโหลดบทเรียนได้");
        return res.json();
      })
      .then((d: LessonDetail) => {
        setLesson(d);
        if (d.progress) {
          setWatchedPercent(d.progress.watchedPercent);
          if (d.progress.completed) {
            setCompleted(true);
            autoCompletedRef.current = true;
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Get next lesson for auto-advance
    learnFetch(`/learn/courses/${slug}`)
      .then((r) => r.json())
      .then((course) => {
        const all: { id: string; completed: boolean }[] = [];
        course.chapters?.forEach((ch: any) => ch.lessons?.forEach((l: any) => all.push({ id: l.id, completed: l.completed })));
        const idx = all.findIndex((l) => l.id === lessonId);
        setNextLessonId(idx < all.length - 1 ? all[idx + 1].id : null);
        if (all[idx]?.completed) setCompleted(true);
      })
      .catch(e => console.error("API error:", e));
  }, [slug, lessonId, session?.user?.email, status]);

  /** เครื่องเล่นรายงานมาเป็นรอบ — บันทึกตำแหน่งไว้ให้ดูต่อได้ และติ๊กจบให้เมื่อถึง 90% */
  const handleVideoProgress = useCallback(
    async ({ position, percent, watched, duration }: { position: number; percent: number; watched: number; duration: number }) => {
      if (!session?.user?.email) return;
      setWatchedPercent((prev) => Math.max(prev, percent));
      try {
        // ส่ง duration ไปด้วย — ถ้าแอดมินยังไม่ได้กรอกความยาว backend จะเติมให้จากค่าจริง
        const res = await learnPost("/learn/progress", { lessonId, position, watchedPercent: percent, watched, duration });
        const data = await res.json().catch(() => null);
        if (data?.completed && !autoCompletedRef.current) {
          autoCompletedRef.current = true;
          setCompleted(true);
        }
      } catch {
        // เน็ตหลุดชั่วคราวไม่ต้องรบกวนผู้เรียน รอบหน้าค่อยส่งใหม่
      }
    },
    [lessonId, session?.user?.email]
  );

  const handleMarkComplete = async () => {
    if (!session?.user?.email || marking || completed) return;
    setMarking(true);
    try {
      const res = await learnPost("/learn/progress", { lessonId, completed: true });
      if (res.ok) {
        setCompleted(true);
        if (nextLessonId) {
          router.push(`/learn/${slug}/${nextLessonId}`);
          return;
        }
        router.refresh();
      } else {
        alert("บันทึกความก้าวหน้าไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch {
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally { setMarking(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lms-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error || "ไม่พบบทเรียน"}</p>
          <Link href={`/learn/${slug}`} className="mt-3 inline-block text-sm text-[var(--lms-accent-text)] hover:underline">กลับหน้าคอร์ส</Link>
        </div>
      </div>
    );
  }

  const ytId = getYouTubeId(lesson.videoUrl || "");

  return (
    <div>
      {/* Video */}
      {lesson.type !== "quiz" && (lesson.type === "video" || lesson.videoUrl) && (
        <div className="p-3 sm:p-5">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-lg bg-black" style={{ paddingBottom: "56.25%" }}>
            {ytId ? (
              <YouTubePlayer
                videoId={ytId}
                title={lesson.title}
                startAt={lesson.progress?.position ?? 0}
                onProgress={handleVideoProgress}
              />
            ) : lesson.videoUrl ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[var(--lms-text-faint)]">
                <p className="text-sm">ลิงก์วิดีโอไม่ถูกต้อง (รองรับเฉพาะ YouTube)</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--lms-text-faint)]">
                <p className="text-sm">วิดีโอกำลังเตรียมพร้อม</p>
              </div>
            )}
          </div>

          {/* ความคืบหน้าการดู — ระบบติ๊กว่าเรียนจบให้เองเมื่อถึง 90% */}
          {ytId && (
            <div className="mx-auto mt-2 max-w-4xl">
              <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                <span>{completed ? "ดูจบแล้ว" : `ดูไปแล้ว ${watchedPercent}%`}</span>
                {!completed && <span>ถึง 90% ระบบจะติ๊กว่าเรียนจบให้เอง</span>}
              </div>
              <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--lms-border)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${watchedPercent}%`, background: completed ? "var(--lms-green)" : "var(--lms-accent)" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lesson Info */}
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6">
        {/* Title + Mark complete */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">{lesson.title}</h1>
            {lesson.description && (
              <p className="mt-2 text-sm text-[var(--lms-text-secondary)] leading-relaxed">{lesson.description}</p>
            )}
          </div>

          {/* Compact complete button */}
          {lesson.type === "quiz" ? (
            completed ? (
              <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--lms-accent)]/10 px-3 py-1.5">
                <svg className="h-4 w-4 text-[var(--lms-accent-text)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-[var(--lms-accent-text)]">สอบผ่านแล้ว</span>
              </div>
            ) : (
              /* บทเรียนแบบข้อสอบต้องสอบผ่านเท่านั้น กดปุ่มข้ามไม่ได้ */
              <span className="shrink-0 text-xs" style={{ color: "var(--lms-text-faint)" }}>
                ต้องสอบผ่านถึงจะนับว่าเรียนจบ
              </span>
            )
          ) : completed ? (
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--lms-accent)]/10 px-3 py-1.5">
              <svg className="h-4 w-4 text-[var(--lms-accent-text)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-[var(--lms-accent-text)]">เรียนแล้ว</span>
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={marking}
              className="shrink-0 rounded-lg bg-[var(--lms-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {marking ? "..." : "เรียนจบแล้ว"}
            </button>
          )}
        </div>

        <div className="h-px bg-[var(--lms-border)] mb-5" />

        {/* แบบทดสอบ */}
        {lesson.type === "quiz" && (
          <div className="mb-6">
            <QuizRunner lessonId={lessonId} onPassed={() => setCompleted(true)} />
          </div>
        )}

        {/* Text content */}
        {lesson.type === "text" && lesson.content && (
          <div className="mb-6 text-sm leading-relaxed text-[var(--lms-text-secondary)] whitespace-pre-wrap">
            {lesson.content}
          </div>
        )}

        {/* Attachments */}
        {lesson.attachments && lesson.attachments.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-[var(--lms-text-secondary)]">ไฟล์ประกอบการเรียน</h3>
            <div className="space-y-2">
              {lesson.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-[var(--lms-border)] bg-[var(--lms-bg-card)] px-4 py-3 transition hover:bg-[var(--lms-bg-card-hover)]"
                >
                  <svg className="h-5 w-5 shrink-0 text-[var(--lms-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-[var(--lms-text)]">{att.name}</span>
                    <span className="text-[11px] text-[var(--lms-text-faint)]">{formatBytes(att.size)}</span>
                  </div>
                  <span className="shrink-0 rounded-md bg-[var(--lms-bg-input)] px-2.5 py-1 text-xs text-[var(--lms-text-secondary)] transition hover:bg-[var(--lms-border)]">
                    ดาวน์โหลด
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
