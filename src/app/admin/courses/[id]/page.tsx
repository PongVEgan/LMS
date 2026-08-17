"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminDelete,
  adminGet,
  adminJson,
  adminPost,
  adminPut,
  formatDuration,
  parseDuration,
} from "@/lib/admin-fetch";
import { getYouTubeEmbedUrl, getYouTubeId } from "@/lib/video";
import { useYouTubeDuration } from "@/lib/youtube-api";
import ImageUpload from "@/components/ImageUpload";
import AttachmentManager, { type Attachment } from "@/components/AttachmentManager";

interface AdminLesson {
  id: string;
  title: string;
  description: string | null;
  type: string;
  content: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  isFree: boolean;
  attachments: Attachment[];
}
interface AdminChapter { id: string; title: string; order: number; lessons: AdminLesson[] }
interface AdminStudent { id: string; email: string; name: string | null; customerCode: string; enrolledAt: string }
interface CourseDetail {
  id: string; slug: string; title: string; description: string | null;
  coverUrl: string | null; price: number; published: boolean;
  chapters: AdminChapter[]; students: AdminStudent[];
}

// ตัวเลข หรือ ชม:นาที:วินาที (ใช้ : หรือ . เป็นตัวคั่น) — 0 หรือ 0:00 ถือว่าถูกต้อง
const DURATION_PATTERN = /^\d+([:.]\d{1,2}){0,2}$/;

const TABS = [
  { key: "content", label: "เนื้อหา" },
  { key: "settings", label: "ตั้งค่าคอร์ส" },
  { key: "students", label: "ผู้เรียน" },
] as const;

export default function AdminCourseEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("content");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = () =>
    adminGet(`/courses/${id}`).then(adminJson<CourseDetail>).then(setCourse).catch((e) => setError(e.message));

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user?.email, status]);

  const show = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  /** ครอบ action ทุกตัวให้จัดการ error + reload ที่เดียว */
  const run = async (fn: () => Promise<Response>, okMsg?: string) => {
    setError("");
    try {
      await adminJson(await fn());
      await load();
      if (okMsg) show(okMsg);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !course) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!course) return <div className="p-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</div>;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/admin/courses" className="text-xs hover:underline" style={{ color: "var(--lms-text-muted)" }}>
        ← คอร์สทั้งหมด
      </Link>
      <h1 className="mt-2 text-xl font-bold">{course.title}</h1>
      <p className="mb-4 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>/learn/{course.slug}</p>

      <div className="mb-5 flex gap-1 border-b" style={{ borderColor: "var(--lms-border)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm transition"
            style={{
              color: tab === t.key ? "var(--lms-accent-text)" : "var(--lms-text-muted)",
              borderBottom: `2px solid ${tab === t.key ? "var(--lms-accent)" : "transparent"}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {toast && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-sm text-green-400">{toast}</p>
        </div>
      )}

      {tab === "content" && <ContentTab course={course} run={run} />}
      {tab === "settings" && <SettingsTab course={course} run={run} onDeleted={() => router.push("/admin/courses")} />}
      {tab === "students" && <StudentsTab course={course} run={run} />}
    </div>
  );
}

/* ------------------------------------------------------------------ เนื้อหา */

function ContentTab({ course, run }: { course: CourseDetail; run: (fn: () => Promise<Response>, msg?: string) => Promise<void> }) {
  const [newChapter, setNewChapter] = useState("");
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {course.chapters.map((ch) => (
        <div key={ch.id} className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <input
              defaultValue={ch.title}
              onBlur={(e) => e.target.value !== ch.title && run(() => adminPut(`/chapters/${ch.id}`, { title: e.target.value }), "บันทึกชื่อบทแล้ว")}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium lms-input"
            />
            <button
              onClick={() => confirm(`ลบบท "${ch.title}" และบทเรียนทั้งหมดในบท?`) && run(() => adminDelete(`/chapters/${ch.id}`), "ลบบทแล้ว")}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs transition hover:opacity-80"
              style={{ color: "var(--lms-red)", border: "1px solid var(--lms-border)" }}>
              ลบบท
            </button>
          </div>

          <div className="space-y-2">
            {ch.lessons.map((l) =>
              editingLesson === l.id ? (
                <LessonForm key={l.id} lesson={l} onCancel={() => setEditingLesson(null)}
                  onSave={async (body) => { await run(() => adminPut(`/lessons/${l.id}`, body), "บันทึกบทเรียนแล้ว"); setEditingLesson(null); }}
                  onAddFile={(f) => run(() => adminPost(`/lessons/${l.id}/attachments`, f), "เพิ่มไฟล์แล้ว")}
                  onRemoveFile={(fid) => run(() => adminDelete(`/attachments/${fid}`), "ลบไฟล์แล้ว")} />
              ) : (
                <div key={l.id} className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: "var(--lms-bg-input)", border: "1px solid var(--lms-border)" }}>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
                    {l.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                  {l.attachments?.length > 0 && (
                    <span className="shrink-0 text-[10px]" style={{ color: "var(--lms-text-faint)" }}>
                      📎 {l.attachments.length}
                    </span>
                  )}
                  {l.type === "video" && !getYouTubeEmbedUrl(l.videoUrl || "") && (
                    <span className="shrink-0 text-[10px]" style={{ color: "var(--lms-red)" }}>ลิงก์ไม่ใช่ YouTube</span>
                  )}
                  <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--lms-text-faint)" }}>
                    {formatDuration(l.duration)}
                  </span>
                  <button onClick={() => setEditingLesson(l.id)} className="shrink-0 text-xs hover:underline"
                    style={{ color: "var(--lms-accent-text)" }}>แก้ไข</button>
                  <button onClick={() => confirm(`ลบบทเรียน "${l.title}"?`) && run(() => adminDelete(`/lessons/${l.id}`), "ลบบทเรียนแล้ว")}
                    className="shrink-0 text-xs hover:underline" style={{ color: "var(--lms-red)" }}>ลบ</button>
                </div>
              )
            )}

            {addingTo === ch.id ? (
              <LessonForm onCancel={() => setAddingTo(null)}
                onSave={async (body) => { await run(() => adminPost(`/chapters/${ch.id}/lessons`, body), "เพิ่มบทเรียนแล้ว"); setAddingTo(null); }} />
            ) : (
              <button onClick={() => setAddingTo(ch.id)}
                className="w-full rounded-lg py-2 text-xs transition hover:opacity-80"
                style={{ border: "1px dashed var(--lms-border)", color: "var(--lms-text-muted)" }}>
                + เพิ่มบทเรียน
              </button>
            )}
          </div>
        </div>
      ))}

      <form
        onSubmit={(e) => { e.preventDefault(); if (!newChapter.trim()) return; run(() => adminPost(`/courses/${course.id}/chapters`, { title: newChapter.trim() }), "เพิ่มบทแล้ว"); setNewChapter(""); }}
        className="flex gap-2">
        <input value={newChapter} onChange={(e) => setNewChapter(e.target.value)} placeholder="ชื่อบทใหม่ เช่น บทที่ 1 · เริ่มต้น"
          className="flex-1 rounded-lg px-3 py-2 text-sm lms-input" />
        <button type="submit" disabled={!newChapter.trim()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--lms-accent)" }}>
          เพิ่มบท
        </button>
      </form>
    </div>
  );
}

function LessonForm({ lesson, onSave, onCancel, onAddFile, onRemoveFile }: {
  lesson?: AdminLesson;
  onSave: (body: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
  /** ไฟล์แนบผูกกับ lesson id — ตอนสร้างบทเรียนใหม่ยังไม่มี id เลยยังแนบไม่ได้ */
  onAddFile?: (file: { url: string; name: string; size: number }) => Promise<void>;
  onRemoveFile?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    type: lesson?.type ?? "video",
    videoUrl: lesson?.videoUrl ?? "",
    content: lesson?.content ?? "",
    description: lesson?.description ?? "",
    // 0 = ยังไม่ระบุ ปล่อยช่องว่างไว้ดีกว่าโชว์ 0:00
    duration: lesson && lesson.duration > 0 ? formatDuration(lesson.duration) : "",
    isFree: lesson?.isFree ?? false,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const ytOk = !form.videoUrl || !!getYouTubeEmbedUrl(form.videoUrl);

  // อ่านความยาวจริงจากคลิปที่วางลิงก์มา
  const ytId = form.type === "video" ? getYouTubeId(form.videoUrl) : null;
  const { duration: clipDuration, loading: loadingDuration } = useYouTubeDuration(ytId);

  // ช่องว่าง = ใช้ความยาวจากคลิปไปเลย พอผู้ใช้พิมพ์เองค่าที่พิมพ์จะชนะ
  const durationValue = form.duration || (clipDuration ? formatDuration(clipDuration) : "");

  return (
    <div className="space-y-3 rounded-lg p-3" style={{ background: "var(--lms-bg-input)", border: "1px solid var(--lms-accent)" }}>
      <input value={form.title} onChange={set("title")} placeholder="ชื่อบทเรียน"
        className="w-full rounded-lg px-3 py-2 text-sm lms-input" />

      <div className="grid gap-2 sm:grid-cols-3">
        <select value={form.type} onChange={set("type")} className="rounded-lg px-3 py-2 text-sm lms-input">
          <option value="video">video</option>
          <option value="text">text</option>
          <option value="file">file</option>
        </select>
        <div>
          <input value={durationValue} onChange={set("duration")} placeholder="ความยาว เช่น 10:30"
            className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
          {/* บอกทันทีว่าระบบตีความเป็นเท่าไร กันพิมพ์ผิดรูปแบบแล้วได้ค่าเพี้ยน
              0 ถือว่าปกติ (= ไม่ระบุ) ผิดจริงคือพิมพ์อักขระที่ไม่ใช่ตัวเลข/ตัวคั่น */}
          {loadingDuration && form.type === "video" && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>กำลังอ่านความยาวจากคลิป...</p>
          )}
          {clipDuration && durationValue.trim() !== formatDuration(clipDuration) && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, duration: formatDuration(clipDuration) }))}
              className="mt-1 text-[11px] hover:underline" style={{ color: "var(--lms-accent-text)" }}>
              ใช้ความยาวจากคลิป ({formatDuration(clipDuration)})
            </button>
          )}
          {durationValue.trim() !== "" && (
            DURATION_PATTERN.test(durationValue.trim()) ? (
              <p className="mt-1 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                = {formatDuration(parseDuration(durationValue))} นาที ({parseDuration(durationValue)} วินาที)
                {clipDuration && durationValue.trim() === formatDuration(clipDuration) ? " · ดึงจากคลิปให้อัตโนมัติ" : ""}
              </p>
            ) : (
              <p className="mt-1 text-[11px]" style={{ color: "var(--lms-red)" }}>
                รูปแบบไม่ถูกต้อง — ใช้ 10:30 หรือใส่จำนวนวินาที
              </p>
            )
          )}
        </div>
        <label className="flex items-center gap-2 px-1 text-xs" style={{ color: "var(--lms-text-muted)" }}>
          <input type="checkbox" checked={form.isFree} onChange={set("isFree")} />
          ดูฟรี (ไม่ต้องซื้อคอร์ส)
        </label>
      </div>

      {form.type === "video" && (
        <div>
          <input value={form.videoUrl} onChange={set("videoUrl")} placeholder="ลิงก์ YouTube"
            className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
          <p className="mt-1 text-[11px]" style={{ color: ytOk ? "var(--lms-text-faint)" : "var(--lms-red)" }}>
            {ytOk
              ? "วางลิงก์แบบไหนก็ได้: watch?v= · youtu.be · shorts · live · หรือใส่แค่ video id"
              : "ลิงก์นี้ไม่ใช่ YouTube — ผู้เรียนจะเล่นวิดีโอไม่ได้"}
          </p>
        </div>
      )}

      {form.type === "text" && (
        <textarea value={form.content} onChange={set("content")} rows={5} placeholder="เนื้อหาบทความ"
          className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
      )}

      <input value={form.description} onChange={set("description")} placeholder="คำอธิบายสั้นๆ (ไม่บังคับ)"
        className="w-full rounded-lg px-3 py-2 text-sm lms-input" />

      {lesson && onAddFile && onRemoveFile ? (
        <AttachmentManager attachments={lesson.attachments ?? []} onAdd={onAddFile} onRemove={onRemoveFile} />
      ) : (
        <p className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
          บันทึกบทเรียนก่อน แล้วกด &quot;แก้ไข&quot; อีกครั้งเพื่อแนบไฟล์
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onSave({
            title: form.title.trim(),
            type: form.type,
            videoUrl: form.videoUrl.trim() || null,
            content: form.content || null,
            description: form.description || null,
            duration: parseDuration(durationValue),
            isFree: form.isFree,
          })}
          disabled={!form.title.trim()}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--lms-accent)" }}>
          บันทึก
        </button>
        <button onClick={onCancel} className="rounded-lg px-4 py-1.5 text-sm transition hover:opacity-80"
          style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ตั้งค่าคอร์ส */

function SettingsTab({ course, run, onDeleted }: {
  course: CourseDetail;
  run: (fn: () => Promise<Response>, msg?: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    title: course.title,
    slug: course.slug,
    description: course.description ?? "",
    coverUrl: course.coverUrl ?? "",
    price: String(course.price),
    published: course.published,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <div>
          <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อคอร์ส</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>slug</label>
            <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ราคา (บาท)</label>
            <input type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>คำอธิบาย</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
        </div>
        <ImageUpload
          label="รูปปกคอร์ส"
          folder="course"
          value={form.coverUrl || null}
          onChange={(url) => setForm((f) => ({ ...f, coverUrl: url ?? "" }))}
        />
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--lms-text-secondary)" }}>
          <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
          เผยแพร่ (ให้เห็นในแคตตาล็อก)
        </label>

        <button
          onClick={() => run(() => adminPut(`/courses/${course.id}`, {
            title: form.title.trim(),
            slug: form.slug.trim(),
            description: form.description,
            coverUrl: form.coverUrl,
            price: Number(form.price) || 0,
            published: form.published,
          }), "บันทึกแล้ว")}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}>
          บันทึก
        </button>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <h3 className="mb-1 text-sm font-medium" style={{ color: "var(--lms-red)" }}>ลบคอร์ส</h3>
        <p className="mb-3 text-xs" style={{ color: "var(--lms-text-muted)" }}>
          ลบบท บทเรียน สิทธิ์เรียน และความคืบหน้าของผู้เรียนทั้งหมดในคอร์สนี้ ย้อนกลับไม่ได้
        </p>
        <button
          onClick={async () => {
            if (!confirm(`ลบคอร์ส "${course.title}" ทั้งหมด?`)) return;
            await run(() => adminDelete(`/courses/${course.id}`));
            onDeleted();
          }}
          className="rounded-lg px-4 py-2 text-sm transition hover:opacity-80"
          style={{ border: "1px solid var(--lms-red)", color: "var(--lms-red)" }}>
          ลบคอร์สนี้
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- ผู้เรียน */

function StudentsTab({ course, run }: { course: CourseDetail; run: (fn: () => Promise<Response>, msg?: string) => Promise<void> }) {
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!email.trim()) return; run(() => adminPost(`/courses/${course.id}/students`, { email: email.trim() }), "ให้สิทธิ์เรียนแล้ว"); setEmail(""); }}
        className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="อีเมลผู้เรียน"
          className="flex-1 rounded-lg px-3 py-2 text-sm lms-input" />
        <button type="submit" disabled={!email.trim()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--lms-accent)" }}>
          ให้สิทธิ์เรียน
        </button>
      </form>
      <p className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
        ผู้เรียนต้องสมัครสมาชิกในระบบก่อน จึงจะให้สิทธิ์ได้
      </p>

      {course.students.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ยังไม่มีผู้เรียนในคอร์สนี้</p>
      ) : (
        <div className="space-y-2">
          {course.students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.name || s.email.split("@")[0]}</p>
                <p className="truncate text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{s.email}</p>
              </div>
              <Link href={`/admin/students?q=${encodeURIComponent(s.email)}`} className="shrink-0 text-xs hover:underline"
                style={{ color: "var(--lms-accent-text)" }}>ดูข้อมูล</Link>
              <button
                onClick={() => confirm(`ถอนสิทธิ์เรียนของ ${s.email}?`) && run(() => adminDelete(`/courses/${course.id}/students/${s.id}`), "ถอนสิทธิ์แล้ว")}
                className="shrink-0 text-xs hover:underline" style={{ color: "var(--lms-red)" }}>
                ถอนสิทธิ์
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
