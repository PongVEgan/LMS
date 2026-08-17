"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, createContext, useContext } from "react";
import { learnFetch, LMS_API } from "@/lib/learn-fetch";
import { SITE_NAME } from "@/lib/site";

// --- Theme ---
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });
export function useTheme() { return useContext(ThemeCtx); }

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const saved = localStorage.getItem("lms-theme") as Theme;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("lms-theme", next);
  };
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

// --- Sidebar Data ---
interface SidebarCourse { id: string; slug: string; title: string; coverUrl: string | null; progress: { percent: number }; }
interface CurriculumLesson { id: string; title: string; duration: number; type: string; completed: boolean; }
interface CurriculumChapter { id: string; title: string; order: number; lessons: CurriculumLesson[]; }

function formatDur(s: number) { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, "0")}`; }

// --- Sidebar Content ---
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [courses, setCourses] = useState<SidebarCourse[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [courseTitle, setCourseTitle] = useState("");

  const isLearnHome = pathname === "/learn";
  const currentSlug = pathname.match(/^\/learn\/([^/]+)/)?.[1];
  const currentLessonId = pathname.match(/^\/learn\/[^/]+\/([^/]+)/)?.[1];
  // path ที่ไม่ใช่ slug ของคอร์ส — กันไม่ให้ sidebar ไปโหลด curriculum ของ "คอร์ส" ที่ไม่มีจริง
  const nonCourseSlugs = ["login", "register", "forgot-password", "reset-password", "profile", "community", "checkout"];
  const isInsideCourse = !!currentSlug && !nonCourseSlugs.includes(currentSlug);

  useEffect(() => {
    if (!session?.user?.email) return;
    learnFetch("/learn/my-courses")
      .then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])).catch(e => console.error("API error:", e));
  }, [session?.user?.email]);

  useEffect(() => {
    if (!isInsideCourse || !session?.user?.email) { setChapters([]); setCourseTitle(""); return; }
    learnFetch(`/learn/courses/${currentSlug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setChapters(d.chapters); setCourseTitle(d.title); } })
      .catch(e => console.error("API error:", e));
  }, [currentSlug, isInsideCourse, session?.user?.email]);

  return (
    <>
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-4 shrink-0" style={{ borderBottom: "1px solid var(--lms-border)" }}>
        <Link href="/learn" className="flex items-center gap-2" onClick={onClose}>
          <Image src="/logo.svg" alt="" width={24} height={24} className="rounded" />
          <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button onClick={toggle} className="relative flex h-7 w-[52px] items-center rounded-full p-0.5 transition-colors duration-300" style={{ background: theme === "dark" ? "var(--lms-border)" : "var(--lms-accent)" }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 z-10" style={{ transform: theme === "light" ? "translateX(26px)" : "translateX(0)" }}>
              {theme === "dark" ? (
                <svg className="h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              )}
            </span>
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded p-1" style={{ color: "var(--lms-text-muted)" }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">
        {isInsideCourse && chapters.length > 0 ? (
          <div className="p-3">
            <Link href="/learn" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-80" style={{ color: "var(--lms-text-muted)" }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              คอร์สทั้งหมด
            </Link>
            <div className="mt-3 mb-4 px-3"><h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--lms-text)" }}>{courseTitle}</h3></div>
            <div className="space-y-4">
              {chapters.map(ch => (
                <div key={ch.id}>
                  <div className="flex items-center justify-between px-3 mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider truncate" style={{ color: "var(--lms-text-faint)" }}>{ch.title}</span>
                    <span className="text-[10px] tabular-nums shrink-0 ml-2" style={{ color: "var(--lms-text-faint)" }}>{ch.lessons.filter(l => l.completed).length}/{ch.lessons.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {ch.lessons.map(lesson => {
                      const active = currentLessonId === lesson.id;
                      return (
                        <Link key={lesson.id} href={`/learn/${currentSlug}/${lesson.id}`} onClick={onClose}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition"
                          style={{ background: active ? "var(--lms-accent-bg)" : "transparent", color: active ? "var(--lms-accent-text)" : "var(--lms-text-secondary)" }}>
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ border: `1px solid ${lesson.completed ? "var(--lms-green)" : active ? "var(--lms-accent)" : "var(--lms-border)"}`, background: lesson.completed ? "rgba(34,197,94,0.1)" : "transparent" }}>
                            {lesson.completed ? (
                              <svg className="h-3 w-3" style={{ color: "var(--lms-green)" }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            ) : (
                              <span className="text-[9px]" style={{ color: "var(--lms-text-faint)" }}>{lesson.type === "text" ? "T" : lesson.type === "file" ? "F" : "V"}</span>
                            )}
                          </div>
                          <span className="flex-1 truncate">{lesson.title}</span>
                          <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--lms-text-faint)" }}>{formatDur(lesson.duration)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            <Link href="/learn" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
              style={{ background: isLearnHome ? "var(--lms-accent-bg)" : "transparent", color: isLearnHome ? "var(--lms-text)" : "var(--lms-text-secondary)", fontWeight: isLearnHome ? 500 : 400 }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              หน้าหลัก
            </Link>
            <Link href="/learn/community" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
              style={{ background: pathname.startsWith("/learn/community") ? "var(--lms-accent-bg)" : "transparent", color: pathname.startsWith("/learn/community") ? "var(--lms-text)" : "var(--lms-text-secondary)", fontWeight: pathname.startsWith("/learn/community") ? 500 : 400 }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
              Community
            </Link>
            {courses.length > 0 && <div className="pt-3 pb-1 px-3"><span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--lms-text-faint)" }}>คอร์สของฉัน</span></div>}
            {courses.map(course => (
              <Link key={course.id} href={`/learn/${course.slug}`} onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition"
                style={{ background: currentSlug === course.slug ? "var(--lms-accent-bg)" : "transparent", color: currentSlug === course.slug ? "var(--lms-text)" : "var(--lms-text-secondary)" }}>
                {course.coverUrl ? <img src={course.coverUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={{ background: "var(--lms-bg-card)" }}>
                    <svg className="h-4 w-4" style={{ color: "var(--lms-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{course.title}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "var(--lms-border)" }}><div className="h-full rounded-full" style={{ width: `${course.progress.percent}%`, background: "var(--lms-accent)" }} /></div>
                    <span className="text-[10px] tabular-nums" style={{ color: "var(--lms-text-faint)" }}>{course.progress.percent}%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User */}
      {session?.user && (
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid var(--lms-border)" }}>
          {(session.user as { role?: string }).role === "admin" && (
            <Link href="/admin" onClick={onClose} className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-80" style={{ color: "var(--lms-text-muted)" }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              หลังบ้าน
            </Link>
          )}
          <Link href="/learn/profile" onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:opacity-80">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
              {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm" style={{ color: "var(--lms-text)" }}>{session.user.name || "User"}</p>
              <p className="truncate text-[11px]" style={{ color: "var(--lms-text-muted)" }}>{session.user.email}</p>
            </div>
          </Link>
          <button onClick={() => setShowLogoutModal(true)} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs transition hover:opacity-70" style={{ color: "var(--lms-text-muted)" }}>
            ออกจากระบบ
          </button>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "var(--lms-bg-overlay)" }} onClick={() => !loggingOut && setShowLogoutModal(false)}>
          <div className="w-full max-w-xs rounded-2xl p-6 text-center" style={{ background: "var(--lms-bg-secondary)", border: "1px solid var(--lms-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
            {loggingOut ? (
              <>
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} />
                <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังออกจากระบบ...</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--lms-accent-bg)" }}>
                  <svg className="h-6 w-6" style={{ color: "var(--lms-accent-text)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="mb-1 text-base font-semibold" style={{ color: "var(--lms-text)" }}>ออกจากระบบ</h3>
                <p className="mb-5 text-sm" style={{ color: "var(--lms-text-muted)" }}>ยืนยันว่าต้องการออกจากระบบ?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLogoutModal(false)} className="flex-1 rounded-lg py-2.5 text-sm font-medium transition" style={{ background: "var(--lms-bg-card)", color: "var(--lms-text-secondary)", border: "1px solid var(--lms-border)" }}>
                    ยกเลิก
                  </button>
                  <button onClick={() => { setLoggingOut(true); setTimeout(() => signOut({ callbackUrl: "/learn/login" }), 800); }} className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-black transition hover:opacity-90" style={{ background: "var(--lms-accent)" }}>
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// --- Shell ---
function LearnShell({ children }: { children: React.ReactNode }) {
  const { data: shellSession } = useSession();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Store email for learn-fetch — sync before children render
  if (typeof window !== "undefined" && shellSession?.user?.email) {
    sessionStorage.setItem("learn-email", shellSession.user.email);
  }
  const authPages = ["/learn/login", "/learn/register", "/learn/forgot-password", "/learn/reset-password"];
  const isAuthPage = authPages.includes(pathname);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isAuthPage) {
    return <div data-theme={theme} className="min-h-screen" style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>{children}</div>;
  }

  return (
    <div data-theme={theme} style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>
      {/* Mobile */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 backdrop-blur-md" style={{ background: "var(--lms-topbar)", borderBottom: "1px solid var(--lms-border)" }}>
          <button onClick={() => setMobileOpen(true)} className="rounded p-1.5" style={{ color: "var(--lms-text-muted)" }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/learn" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={24} height={24} className="rounded" />
            <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME}</span>
          </Link>
          <div className="w-8" />
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0" style={{ background: "var(--lms-bg-overlay)" }} />
            <aside className="absolute left-0 top-0 bottom-0 flex w-[280px] max-w-[85vw] flex-col" style={{ background: "var(--lms-bg-secondary)", borderRight: "1px solid var(--lms-border)" }} onClick={e => e.stopPropagation()}>
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
        <main className="min-h-screen w-full overflow-x-hidden">{children}</main>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex lg:h-screen">
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto" style={{ background: "var(--lms-bg-secondary)", borderRight: "1px solid var(--lms-border)" }}>
          <SidebarContent />
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LearnShell>{children}</LearnShell>
      </ThemeProvider>
    </SessionProvider>
  );
}
