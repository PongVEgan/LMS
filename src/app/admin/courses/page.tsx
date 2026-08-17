"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminGet, adminJson, adminPost } from "@/lib/admin-fetch";

interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  price: number;
  published: boolean;
  chapterCount: number;
  lessonCount: number;
  studentCount: number;
}

export default function AdminCoursesPage() {
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", price: "0" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    adminGet("/courses")
      .then(adminJson<AdminCourse[]>)
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    load();
  }, [session?.user?.email, status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminJson(await adminPost("/courses", {
        title: form.title.trim(),
        slug: form.slug.trim(),
        price: Number(form.price) || 0,
      }));
      setForm({ title: "", slug: "", price: "0" });
      setCreating(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">คอร์สทั้งหมด</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}
        >
          {creating ? "ยกเลิก" : "+ สร้างคอร์ส"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="mb-5 space-y-3 rounded-xl p-4"
          style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อคอร์ส</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>
                slug (ใช้ใน URL — a-z, 0-9, -)
              </label>
              <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                required placeholder="my-course" className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ราคา (บาท)</label>
              <input type="number" min="0" value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--lms-accent)" }}>
            {saving ? "กำลังสร้าง..." : "สร้างคอร์ส"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</p>
      ) : courses.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ยังไม่มีคอร์ส</p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => (
            <Link key={c.id} href={`/admin/courses/${c.id}`}
              className="flex items-center gap-4 rounded-xl px-4 py-3 transition hover:opacity-80"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium" style={{ color: "var(--lms-text)" }}>{c.title}</span>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: c.published ? "rgba(34,197,94,0.12)" : "var(--lms-border)",
                      color: c.published ? "var(--lms-green)" : "var(--lms-text-muted)",
                    }}>
                    {c.published ? "เผยแพร่" : "ฉบับร่าง"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                  /{c.slug} · {c.chapterCount} บท · {c.lessonCount} บทเรียน · {c.studentCount} ผู้เรียน
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums" style={{ color: "var(--lms-accent-text)" }}>
                {c.price > 0 ? `฿${c.price.toLocaleString()}` : "ฟรี"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
