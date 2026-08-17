"use client";

import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminGet, adminJson, adminPut } from "@/lib/admin-fetch";

interface StudentRow {
  id: string; email: string; name: string | null; phone: string | null;
  lineId: string | null; role: string; createdAt: string; courseCount: number;
}
interface StudentDetail extends StudentRow {
  businessName: string | null;
  province: string | null;
  courses: { id: string; title: string; customerCode: string; enrolledAt: string; total: number; completed: number; percent: number }[];
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function StudentsContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (term: string) => {
    adminGet(`/students?search=${encodeURIComponent(term)}`)
      .then(adminJson<StudentRow[]>)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, session?.user?.email, status]);

  const openDetail = (id: string) =>
    adminGet(`/students/${id}`).then(adminJson<StudentDetail>).then(setDetail).catch((e) => setError(e.message));

  const changeRole = async (id: string, role: string) => {
    setError("");
    try {
      await adminJson(await adminPut(`/students/${id}/role`, { role }));
      await openDetail(id);
      load(search);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-bold">ผู้เรียนทั้งหมด</h1>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาจากอีเมลหรือชื่อ"
        className="mb-4 w-full rounded-lg px-3 py-2 text-sm lms-input" />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ไม่พบผู้ใช้</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <button key={s.id} onClick={() => openDetail(s.id)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-80"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
                {(s.name || s.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm">{s.name || s.email.split("@")[0]}</span>
                  {s.role === "admin" && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>admin</span>
                  )}
                </div>
                <p className="truncate text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{s.email}</p>
              </div>
              <span className="shrink-0 text-xs" style={{ color: "var(--lms-text-muted)" }}>{s.courseCount} คอร์ส</span>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "var(--lms-bg-overlay)" }}
          onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5"
            style={{ background: "var(--lms-bg-secondary)", border: "1px solid var(--lms-border)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{detail.name || detail.email.split("@")[0]}</h2>
                <p className="truncate text-xs" style={{ color: "var(--lms-text-muted)" }}>{detail.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 rounded p-1" style={{ color: "var(--lms-text-muted)" }}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <dl className="mb-4 grid grid-cols-2 gap-y-2 text-xs">
              {[
                ["สมัครเมื่อ", fmt(detail.createdAt)],
                ["เบอร์โทร", detail.phone || "—"],
                ["Line ID", detail.lineId || "—"],
                ["ธุรกิจ", detail.businessName || "—"],
                ["จังหวัด", detail.province || "—"],
                ["สิทธิ์", detail.role],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt style={{ color: "var(--lms-text-faint)" }}>{k}</dt>
                  <dd style={{ color: "var(--lms-text-secondary)" }}>{v}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mb-2 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>คอร์สที่เรียน</h3>
            {detail.courses.length === 0 ? (
              <p className="py-3 text-center text-xs" style={{ color: "var(--lms-text-faint)" }}>ยังไม่มีคอร์ส</p>
            ) : (
              <div className="mb-4 space-y-3">
                {detail.courses.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate" style={{ color: "var(--lms-text)" }}>{c.title}</span>
                      <span className="ml-2 shrink-0 tabular-nums" style={{ color: "var(--lms-text-muted)" }}>
                        {c.completed}/{c.total} · {c.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--lms-border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${c.percent}%`, background: "var(--lms-accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => changeRole(detail.id, detail.role === "admin" ? "user" : "admin")}
              className="w-full rounded-lg py-2 text-sm transition hover:opacity-80"
              style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
              {detail.role === "admin" ? "ถอดสิทธิ์แอดมิน" : "ตั้งเป็นแอดมิน"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense>
      <StudentsContent />
    </Suspense>
  );
}
