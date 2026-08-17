"use client";

import { learnFetch , LMS_API } from "@/lib/learn-fetch";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";


const LEVEL_COLORS: Record<number, string> = {
  1: "bg-zinc-700 text-zinc-300", 2: "bg-zinc-700 text-zinc-300",
  3: "bg-blue-500/20 text-blue-300", 4: "bg-blue-500/20 text-blue-300",
  5: "bg-purple-500/20 text-purple-300", 6: "bg-purple-500/20 text-purple-300",
  7: "bg-yellow-500/20 text-yellow-300", 8: "bg-yellow-500/20 text-yellow-300",
  9: "bg-gradient-to-r from-yellow-400 to-pink-500 text-white",
};
const LEVEL_NAMES = ["", "นักเรียนใหม่", "เริ่มสนุก", "ขาประจำ", "นักสนทนา", "ผู้รู้", "ผู้แบ่งปัน", "ผู้เชี่ยวชาญ", "Mentor", "Master"];

interface Member {
  id: string; email: string; name: string | null; businessName: string | null;
  industry: string | null; province: string | null; createdAt: string;
  level: number; points: number; postCount: number;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!session?.user?.email) return;
    learnFetch("/community/members")
      .then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : [])).catch(e => console.error("API error:", e)).finally(() => setLoading(false));
  }, [session?.user?.email]);

  const filtered = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q) ||
      (m.businessName || "").toLowerCase().includes(q) || (m.industry || "").toLowerCase().includes(q) || (m.province || "").toLowerCase().includes(q);
  });

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} /></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6">
      <Link href="/learn/community" className="mb-4 inline-flex items-center gap-1 text-sm transition hover:opacity-70" style={{ color: "var(--lms-text-muted)" }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        กลับ Community
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold">สมาชิก ({members.length})</h1>
        <input type="text" placeholder="ค้นหาชื่อ, ธุรกิจ, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg px-4 py-2.5 text-sm lms-input" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map(m => (
          <div key={m.id} className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
                {(m.name || m.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--lms-text)" }}>{m.name || m.email.split("@")[0]}</span>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_COLORS[m.level] || LEVEL_COLORS[1]}`}>Lv.{m.level}</span>
                </div>
                <div className="text-xs truncate" style={{ color: "var(--lms-text-faint)" }}>
                  {[m.businessName, m.industry, m.province].filter(Boolean).join(" · ") || m.email}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
              <span>{m.points} points</span>
              <span>{m.postCount} โพสต์</span>
              <span>{LEVEL_NAMES[m.level] || ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
