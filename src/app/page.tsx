import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { LMS_API, fetchWithTimeout } from "@/lib/fetch-utils";
import { SITE_NAME } from "@/lib/site";

// ดึงคอร์สตอน request — ห้าม prerender ตอน build เพราะ API ยังไม่รัน
export const dynamic = "force-dynamic";

interface PublicCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  lessonCount: number;
  totalDuration: number;
  studentCount: number;
}

/** API ล่มก็ยังต้องเห็นหน้าแรก — คืนค่าว่างแทนที่จะพังทั้งหน้า */
async function getCourses(): Promise<PublicCourse[]> {
  try {
    const res = await fetchWithTimeout(`${LMS_API}/public/courses`, { cache: "no-store" }, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function formatHours(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} นาที`;
  return `${Math.floor(m / 60)} ชม. ${m % 60 ? `${m % 60} นาที` : ""}`.trim();
}

export default async function HomePage() {
  const [session, courses] = await Promise.all([auth(), getCourses()]);
  const loggedIn = !!session?.user;

  return (
    <div className="min-h-screen" style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md"
        style={{ background: "var(--lms-topbar)", borderBottom: "1px solid var(--lms-border)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={26} height={26} className="rounded" />
            <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/learn" className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                style={{ background: "var(--lms-accent)" }}>
                เข้าห้องเรียน
              </Link>
            ) : (
              <>
                <Link href="/learn/login" className="rounded-lg px-3 py-2 text-sm transition hover:opacity-80"
                  style={{ color: "var(--lms-text-secondary)" }}>
                  เข้าสู่ระบบ
                </Link>
                <Link href="/learn/register" className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                  style={{ background: "var(--lms-accent)" }}>
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="inline-block rounded-full px-3 py-1 text-xs"
          style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
          เรียนออนไลน์ได้ทุกที่ ทุกเวลา
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
          เรียนรู้ทักษะใหม่กับ {SITE_NAME}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          style={{ color: "var(--lms-text-secondary)" }}>
          คอร์สวิดีโอพร้อมเอกสารประกอบ เรียนจบแล้วระบบจำความคืบหน้าให้
          พร้อมคอมมูนิตี้ไว้ถามตอบและแลกเปลี่ยนกับผู้เรียนคนอื่น
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href={loggedIn ? "/learn" : "/learn/register"}
            className="rounded-lg px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            style={{ background: "var(--lms-accent)" }}>
            {loggedIn ? "ไปหน้าคอร์สของฉัน" : "เริ่มเรียนเลย"}
          </Link>
          <a href="#courses" className="rounded-lg px-6 py-3 text-sm transition hover:opacity-80"
            style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
            ดูคอร์สทั้งหมด
          </a>
        </div>
      </section>

      {/* จุดขาย */}
      <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "วิดีโอ + เอกสาร", desc: "บทเรียนมีทั้งวิดีโอ บทความ และไฟล์ให้ดาวน์โหลด" },
            { title: "จำความคืบหน้า", desc: "เรียนถึงไหนระบบจำให้ กลับมาเรียนต่อได้ทันที" },
            { title: "คอมมูนิตี้", desc: "ถามตอบ แชร์ประสบการณ์ และเก็บแต้มไต่เลเวลกับเพื่อนร่วมคอร์ส" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl p-5"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--lms-text-muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* คอร์ส */}
      <section id="courses" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="mb-1 text-xl font-bold">คอร์สทั้งหมด</h2>
        <p className="mb-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>
          เลือกคอร์สที่สนใจ แล้วเริ่มเรียนได้ทันทีหลังชำระเงิน
        </p>

        {courses.length === 0 ? (
          <div className="rounded-xl p-10 text-center"
            style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
            <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>ยังไม่มีคอร์สที่เปิดให้ลงทะเบียน</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={loggedIn ? `/learn/checkout/${c.slug}` : "/learn/login"}
                className="group flex flex-col overflow-hidden rounded-xl transition hover:opacity-90"
                style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center" style={{ background: "var(--lms-bg-input)" }}>
                    <svg className="h-8 w-8" style={{ color: "var(--lms-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-sm font-semibold leading-snug">{c.title}</h3>
                  {c.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--lms-text-muted)" }}>
                      {c.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                    <span>{c.lessonCount} บทเรียน</span>
                    {c.totalDuration > 0 && <span>{formatHours(c.totalDuration)}</span>}
                    {c.studentCount > 0 && <span>{c.studentCount} ผู้เรียน</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-base font-bold tabular-nums" style={{ color: "var(--lms-accent-text)" }}>
                      {c.price > 0 ? `฿${c.price.toLocaleString()}` : "ฟรี"}
                    </span>
                    <span className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
                      {loggedIn ? "ซื้อคอร์ส" : "เข้าสู่ระบบเพื่อซื้อ"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ปิดท้าย */}
      {!loggedIn && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl p-8 text-center"
            style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
            <h2 className="text-lg font-bold">พร้อมเริ่มเรียนแล้วหรือยัง?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--lms-text-muted)" }}>
              สมัครสมาชิกฟรี แล้วเลือกซื้อเฉพาะคอร์สที่ต้องการ
            </p>
            <Link href="/learn/register"
              className="mt-5 inline-block rounded-lg px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ background: "var(--lms-accent)" }}>
              สมัครสมาชิก
            </Link>
          </div>
        </section>
      )}

      <footer style={{ borderTop: "1px solid var(--lms-border)" }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs sm:flex-row sm:px-6"
          style={{ color: "var(--lms-text-faint)" }}>
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <div className="flex gap-4">
            <Link href="/learn" className="hover:underline">ห้องเรียน</Link>
            <Link href="/learn/login" className="hover:underline">เข้าสู่ระบบ</Link>
            <Link href="/learn/register" className="hover:underline">สมัครสมาชิก</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
