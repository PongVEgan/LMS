"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LMS_API } from "@/lib/fetch-utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${LMS_API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      setSent(true);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center lms-bg px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link href="/learn/login" className="inline-flex items-center gap-1 text-sm transition hover:opacity-70" style={{ color: "var(--lms-text-muted)" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          กลับ
        </Link>
        <Image src="/logo.svg" alt="" width={64} height={64} className="mx-auto rounded-xl" />
        <h1 className="text-2xl font-bold text-[var(--lms-accent-text)]">ลืมรหัสผ่าน</h1>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">
                ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ {email} แล้ว
              </p>
              <p className="mt-2 text-xs text-[var(--lms-text-muted)]">กรุณาตรวจสอบกล่องข้อความ (รวมถึง spam)</p>
            </div>
            <Link href="/learn/login" className="inline-block text-sm text-[var(--lms-accent-text)] hover:underline">
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--lms-text-secondary)]">กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้</p>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <input
                type="email"
                placeholder="อีเมล"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-lg bg-[var(--lms-accent)] py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
              </button>
            </form>

            <Link href="/learn/login" className="inline-block text-sm text-[var(--lms-text-secondary)] hover:text-[var(--lms-text-secondary)]">
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
