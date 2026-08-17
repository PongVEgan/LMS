"use client";

import { learnFetch , LMS_API } from "@/lib/learn-fetch";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";


interface MyCourse { id: string; slug: string; title: string; description: string | null; coverUrl: string | null; progress: { total: number; completed: number; percent: number }; }
interface CatalogCourse { id: string; slug: string; title: string; description: string | null; coverUrl: string | null; price: number; }

export default function LearnPage() {
  const { data: session, status } = useSession();
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    const email = session?.user?.email || "";
    if (email) sessionStorage.setItem("learn-email", email);
    const p1 = learnFetch("/learn/catalog", undefined, email).then(r => r.json()).then(d => setCatalog(Array.isArray(d) ? d : [])).catch(e => console.error("API error:", e));
    const p2 = email ? learnFetch("/learn/my-courses", undefined, email).then(r => r.json()).then(d => setMyCourses(Array.isArray(d) ? d : [])).catch(e => console.error("API error:", e)) : Promise.resolve();
    Promise.all([p1, p2]).finally(() => setLoading(false));
  }, [session?.user?.email, status]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} /></div>;

  const enrolledSlugs = new Set(myCourses.map(c => c.slug));
  const lockedCourses = catalog.filter(c => !enrolledSlugs.has(c.slug));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="mb-1 text-xl font-bold">สวัสดี, {session?.user?.name ?? "คุณ"}</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>คอร์สเรียนของคุณ</p>

      {myCourses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          {myCourses.map(course => (
            <Link key={course.id} href={`/learn/${course.slug}`} className="group overflow-hidden rounded-xl transition lms-card">
              {course.coverUrl && <img src={course.coverUrl} alt="" className="w-full object-cover aspect-[2/1]" />}
              <div className="p-5">
                <h2 className="text-base font-semibold" style={{ color: "var(--lms-text)" }}>{course.title}</h2>
                {course.description && <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--lms-text-muted)" }}>{course.description}</p>}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs" style={{ color: "var(--lms-text-faint)" }}>
                    <span>ความคืบหน้า</span><span>{course.progress.percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--lms-border)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${course.progress.percent}%`, background: "var(--lms-accent)" }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {lockedCourses.length > 0 && (
        <>
          <h2 className="mb-4 text-sm font-medium" style={{ color: "var(--lms-text-muted)" }}>คอร์สทั้งหมด</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {lockedCourses.map(course => (
              <div key={course.id} className="overflow-hidden rounded-xl lms-card">
                {/* กล่องต้องมีความสูงเสมอ ไม่งั้นคอร์สที่ยังไม่มีรูปปกจะถูกไอคอนกุญแจ (absolute) บีบจนแบน */}
                <div className="relative aspect-[2/1] w-full" style={{ background: "var(--lms-bg-input)" }}>
                  {course.coverUrl && <img src={course.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <svg className="h-8 w-8 opacity-50" style={{ color: "var(--lms-text)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <div className="p-5">
                  <h2 className="text-base font-semibold" style={{ color: "var(--lms-text-secondary)" }}>{course.title}</h2>
                  {course.description && <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--lms-text-muted)" }}>{course.description}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{course.price > 0 ? `฿${course.price.toLocaleString()}` : "ฟรี"}</span>
                    <Link href={`/learn/checkout/${course.slug}`} className="rounded-lg px-4 py-1.5 text-xs font-medium transition" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>ซื้อคอร์ส</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {myCourses.length === 0 && lockedCourses.length === 0 && (
        <div className="rounded-xl p-10 text-center lms-card"><p style={{ color: "var(--lms-text-muted)" }}>ยังไม่มีคอร์สในระบบ</p></div>
      )}
    </div>
  );
}
