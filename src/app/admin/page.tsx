"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminGet, adminJson } from "@/lib/admin-fetch";

interface Stats {
  users: number;
  enrollments: number;
  courses: number;
  lessons: number;
  posts: number;
  completedLessons: number;
  signups: { date: string; count: number }[];
  topCourses: { id: string; title: string; students: number; avgPercent: number }[];
}

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
      <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--lms-text)" }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    adminGet("/stats").then(adminJson<Stats>).then(setStats).catch((e) => setError(e.message));
  }, [session?.user?.email, status]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!stats) return <div className="p-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</div>;

  const maxSignup = Math.max(1, ...stats.signups.map((s) => s.count));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-xl font-bold">ภาพรวมระบบ</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="ผู้ใช้ทั้งหมด" value={stats.users} />
        <Tile label="สิทธิ์เรียน" value={stats.enrollments} />
        <Tile label="คอร์ส" value={stats.courses} />
        <Tile label="บทเรียน" value={stats.lessons} />
        <Tile label="เรียนจบแล้ว" value={stats.completedLessons} hint="นับรายบทเรียน" />
        <Tile label="โพสต์คอมมูนิตี้" value={stats.posts} />
      </div>

      <div className="mb-6 rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>สมัครใหม่ 30 วันล่าสุด</h2>
        <div className="flex h-24 items-end gap-[3px]">
          {stats.signups.map((s) => (
            <div key={s.date} className="group relative flex-1" title={`${s.date}: ${s.count} คน`}>
              <div
                className="w-full rounded-t transition"
                style={{
                  height: `${Math.max(2, (s.count / maxSignup) * 96)}px`,
                  background: s.count > 0 ? "var(--lms-accent)" : "var(--lms-border)",
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--lms-text-faint)" }}>
          <span>{stats.signups[0]?.date}</span>
          <span>{stats.signups.at(-1)?.date}</span>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>คอร์สที่มีผู้เรียนมากที่สุด</h2>
        {stats.topCourses.length === 0 ? (
          <p className="py-4 text-center text-xs" style={{ color: "var(--lms-text-faint)" }}>ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-3">
            {stats.topCourses.map((c) => (
              <Link key={c.id} href={`/admin/courses/${c.id}`} className="block transition hover:opacity-80">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate" style={{ color: "var(--lms-text)" }}>{c.title}</span>
                  <span className="ml-3 shrink-0 tabular-nums text-xs" style={{ color: "var(--lms-text-muted)" }}>
                    {c.students} คน · เฉลี่ย {c.avgPercent}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--lms-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.avgPercent}%`, background: "var(--lms-accent)" }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
