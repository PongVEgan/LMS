"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { learnFetch } from "@/lib/learn-fetch";

interface Cert {
  code: string;
  issuedAt: string;
  quizPercent: number | null;
  courseTitle: string;
  courseSlug: string;
}

export default function MyCertificatesPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    learnFetch("/learn/certificates")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => console.error("API error:", e))
      .finally(() => setLoading(false));
  }, [session?.user?.email, status]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl font-bold">เกียรติบัตรของฉัน</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>
        ได้รับเมื่อเรียนครบทุกบทเรียนและสอบผ่านทุกแบบทดสอบในคอร์ส
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-10 text-center"
          style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
          <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>ยังไม่มีเกียรติบัตร</p>
          <p className="mt-1 text-xs" style={{ color: "var(--lms-text-faint)" }}>
            เรียนให้ครบทุกบทและสอบผ่าน แล้วระบบจะออกให้อัตโนมัติ
          </p>
          <Link href="/learn" className="mt-4 inline-block text-sm hover:underline" style={{ color: "var(--lms-accent-text)" }}>
            ไปหน้าคอร์สของฉัน
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Link key={c.code} href={`/learn/certificates/${c.code}`}
              className="flex items-center gap-4 rounded-xl px-4 py-4 transition hover:opacity-90"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: "var(--lms-accent-bg)" }}>
                🏆
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.courseTitle}</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                  เลขที่ {c.code} · ออกให้ {new Date(c.issuedAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                  {c.quizPercent !== null ? ` · สอบได้ ${c.quizPercent}%` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs" style={{ color: "var(--lms-accent-text)" }}>ดูใบ →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
