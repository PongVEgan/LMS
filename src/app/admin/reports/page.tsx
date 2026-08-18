"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { adminGet, adminJson } from "@/lib/admin-fetch";
import { csvDate, downloadCsv } from "@/lib/csv";

interface Overview {
  from: string; to: string;
  newUsers: number; newEnrollments: number; paidOrders: number; revenue: number;
  awaitingOrders: number; lessonsCompleted: number;
  quizAttempts: number; quizPassed: number; certificates: number;
  daily: { date: string; users: number; revenue: number }[];
}
interface CourseRow {
  id: string; title: string; slug: string; price: number;
  students: number; newStudents: number; lessons: number;
  revenue: number; certificates: number; avgProgress: number; avgQuiz: number | null;
}
interface StudentRow {
  email: string; name: string; courseTitle: string; enrolledAt: string;
  totalLessons: number; completedLessons: number; percent: number;
  quizPercent: number | null; certificate: string | null;
}
interface OrderRow {
  reference: string; email: string; courseTitle: string; amount: number;
  method: string; status: string; createdAt: string; paidAt: string | null;
}
interface CertRow {
  code: string; email: string; name: string; courseTitle: string;
  issuedAt: string; quizPercent: number | null;
}

const TABS = [
  { key: "courses", label: "รายคอร์ส" },
  { key: "students", label: "รายผู้เรียน" },
  { key: "orders", label: "ยอดขาย" },
  { key: "certificates", label: "เกียรติบัตร" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
      <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{hint}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("courses");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    const range = `from=${from}&to=${to}`;
    Promise.all([
      adminGet(`/reports/overview?${range}`).then(adminJson<Overview>),
      adminGet(`/reports/courses?${range}`).then(adminJson<CourseRow[]>),
      adminGet(`/reports/students?${range}`).then(adminJson<StudentRow[]>),
      adminGet(`/reports/orders?${range}`).then(adminJson<OrderRow[]>),
      adminGet(`/reports/certificates`).then(adminJson<CertRow[]>),
    ])
      .then(([o, c, s, or, ce]) => { setOverview(o); setCourses(c); setStudents(s); setOrders(or); setCerts(ce); })
      .catch((e) => setError(e.message));
  }, [from, to, session?.user?.email, status]);

  const maxRevenue = Math.max(1, ...(overview?.daily.map((d) => d.revenue) ?? [1]));
  const th = { color: "var(--lms-text-muted)", borderBottom: "1px solid var(--lms-border)" };
  const td = { borderBottom: "1px solid var(--lms-border)" };

  const exportCurrent = () => {
    const stamp = `${from}_${to}`;
    if (tab === "courses")
      downloadCsv(`รายงานรายคอร์ส_${stamp}`, [
        { key: "title", label: "คอร์ส" }, { key: "price", label: "ราคา" },
        { key: "students", label: "ผู้เรียนทั้งหมด" }, { key: "newStudents", label: "ผู้เรียนใหม่ในช่วง" },
        { key: "lessons", label: "จำนวนบทเรียน" }, { key: "avgProgress", label: "ความคืบหน้าเฉลี่ย (%)" },
        { key: "avgQuiz", label: "คะแนนสอบเฉลี่ย (%)" }, { key: "certificates", label: "เกียรติบัตรที่ออก" },
        { key: "revenue", label: "ยอดขายในช่วง (บาท)" },
      ], courses);
    else if (tab === "students")
      downloadCsv(`รายงานผู้เรียน_${stamp}`, [
        { key: "email", label: "อีเมล" }, { key: "name", label: "ชื่อ" },
        { key: "courseTitle", label: "คอร์ส" }, { key: "enrolled", label: "ลงทะเบียนเมื่อ" },
        { key: "completedLessons", label: "เรียนจบ (บท)" }, { key: "totalLessons", label: "ทั้งหมด (บท)" },
        { key: "percent", label: "ความคืบหน้า (%)" }, { key: "quizPercent", label: "คะแนนสอบ (%)" },
        { key: "certificate", label: "เลขที่เกียรติบัตร" },
      ], students.map((s) => ({ ...s, enrolled: csvDate(s.enrolledAt) })));
    else if (tab === "orders")
      downloadCsv(`รายงานยอดขาย_${stamp}`, [
        { key: "reference", label: "เลขที่" }, { key: "email", label: "ผู้ซื้อ" },
        { key: "courseTitle", label: "คอร์ส" }, { key: "amount", label: "ยอด (บาท)" },
        { key: "method", label: "ช่องทาง" }, { key: "status", label: "สถานะ" },
        { key: "created", label: "สั่งซื้อเมื่อ" }, { key: "paid", label: "จ่ายเมื่อ" },
      ], orders.map((o) => ({ ...o, created: csvDate(o.createdAt), paid: csvDate(o.paidAt) })));
    else
      downloadCsv(`รายงานเกียรติบัตร_${stamp}`, [
        { key: "code", label: "เลขที่" }, { key: "name", label: "ชื่อ" },
        { key: "email", label: "อีเมล" }, { key: "courseTitle", label: "คอร์ส" },
        { key: "issued", label: "ออกให้เมื่อ" }, { key: "quizPercent", label: "คะแนนสอบ (%)" },
      ], certs.map((c) => ({ ...c, issued: csvDate(c.issuedAt) })));
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-bold">รายงานผล</h1>

      {/* ช่วงเวลา */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl p-4"
        style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <div>
          <label className="mb-1 block text-[11px]" style={{ color: "var(--lms-text-faint)" }}>ตั้งแต่</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm lms-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px]" style={{ color: "var(--lms-text-faint)" }}>ถึง</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm lms-input" />
        </div>
        <div className="flex gap-1">
          {([["7 วัน", 6], ["30 วัน", 29], ["90 วัน", 89]] as const).map(([label, n]) => (
            <button key={label} onClick={() => { setFrom(daysAgo(n)); setTo(today()); }}
              className="rounded-lg px-3 py-2 text-xs transition hover:opacity-80"
              style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={exportCurrent}
          className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}>
          ⬇ Export CSV ({TABS.find((t) => t.key === tab)?.label})
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {overview && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile label="ยอดขาย" value={`฿${overview.revenue.toLocaleString()}`} hint={`${overview.paidOrders} คำสั่งซื้อ`} />
            <Tile label="ผู้ใช้ใหม่" value={overview.newUsers} />
            <Tile label="ลงทะเบียนเรียน" value={overview.newEnrollments} />
            <Tile label="สอบผ่าน" value={`${overview.quizPassed}/${overview.quizAttempts}`} hint="ผ่าน/ทำทั้งหมด" />
            <Tile label="เกียรติบัตร" value={overview.certificates} hint="ออกในช่วงนี้" />
          </div>

          {overview.awaitingOrders > 0 && (
            <p className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
              มีคำสั่งซื้อรอตรวจสอบ {overview.awaitingOrders} รายการ
            </p>
          )}

          <div className="mb-6 rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
            <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>ยอดขายรายวัน</h2>
            <div className="flex h-24 items-end gap-[2px]">
              {overview.daily.map((d) => (
                <div key={d.date} className="flex-1" title={`${d.date}: ฿${d.revenue.toLocaleString()} · สมัคร ${d.users} คน`}>
                  <div className="w-full rounded-t"
                    style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 96)}px`, background: d.revenue > 0 ? "var(--lms-accent)" : "var(--lms-border)" }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--lms-text-faint)" }}>
              <span>{overview.from}</span><span>{overview.to}</span>
            </div>
          </div>
        </>
      )}

      <div className="mb-4 flex gap-1 border-b" style={{ borderColor: "var(--lms-border)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2 text-sm transition"
            style={{
              color: tab === t.key ? "var(--lms-accent-text)" : "var(--lms-text-muted)",
              borderBottom: `2px solid ${tab === t.key ? "var(--lms-accent)" : "transparent"}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <table className="w-full text-sm">
          {tab === "courses" && (
            <>
              <thead><tr>
                {["คอร์ส", "ผู้เรียน", "ใหม่", "คืบหน้า", "สอบเฉลี่ย", "เกียรติบัตร", "ยอดขาย"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium ${i === 0 ? "text-left" : "text-right"}`} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3" style={td}>{c.title}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.students}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.newStudents}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.avgProgress}%</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.avgQuiz === null ? "—" : `${c.avgQuiz}%`}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.certificates}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ ...td, color: "var(--lms-accent-text)" }}>฿{c.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "students" && (
            <>
              <thead><tr>
                {["ผู้เรียน", "คอร์ส", "เรียนจบ", "คืบหน้า", "คะแนนสอบ", "เกียรติบัตร"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium ${i < 2 ? "text-left" : "text-right"}`} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={`${s.email}-${i}`}>
                    <td className="px-4 py-3" style={td}>
                      <span className="block">{s.name || s.email.split("@")[0]}</span>
                      <span className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{s.email}</span>
                    </td>
                    <td className="px-4 py-3" style={td}>{s.courseTitle}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{s.completedLessons}/{s.totalLessons}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{s.percent}%</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{s.quizPercent === null ? "—" : `${s.quizPercent}%`}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ ...td, color: s.certificate ? "var(--lms-green)" : "var(--lms-text-faint)" }}>
                      {s.certificate ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "orders" && (
            <>
              <thead><tr>
                {["เลขที่", "ผู้ซื้อ", "คอร์ส", "ช่องทาง", "สถานะ", "ยอด"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium ${i < 3 ? "text-left" : "text-right"}`} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.reference}>
                    <td className="px-4 py-3 font-mono text-xs" style={td}>{o.reference}</td>
                    <td className="px-4 py-3 text-xs" style={td}>{o.email}</td>
                    <td className="px-4 py-3" style={td}>{o.courseTitle}</td>
                    <td className="px-4 py-3 text-right text-xs" style={td}>{o.method}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ ...td, color: o.status === "paid" ? "var(--lms-green)" : "var(--lms-text-muted)" }}>{o.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>฿{o.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "certificates" && (
            <>
              <thead><tr>
                {["เลขที่", "ผู้เรียน", "คอร์ส", "ออกให้เมื่อ", "คะแนนสอบ"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium ${i < 3 ? "text-left" : "text-right"}`} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.code}>
                    <td className="px-4 py-3 font-mono text-xs" style={td}>
                      <a href={`/verify/${c.code}`} target="_blank" rel="noreferrer" className="hover:underline"
                        style={{ color: "var(--lms-accent-text)" }}>{c.code}</a>
                    </td>
                    <td className="px-4 py-3 text-xs" style={td}>{c.name || c.email}</td>
                    <td className="px-4 py-3" style={td}>{c.courseTitle}</td>
                    <td className="px-4 py-3 text-right text-xs" style={td}>
                      {new Date(c.issuedAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={td}>{c.quizPercent === null ? "—" : `${c.quizPercent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>

        {((tab === "courses" && courses.length === 0) ||
          (tab === "students" && students.length === 0) ||
          (tab === "orders" && orders.length === 0) ||
          (tab === "certificates" && certs.length === 0)) && (
          <p className="py-10 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ไม่มีข้อมูลในช่วงเวลานี้</p>
        )}
      </div>
    </div>
  );
}
