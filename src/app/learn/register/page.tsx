"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { LMS_API } from "@/lib/fetch-utils";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);
  // ไม่ได้ตั้ง site key = ไม่ใช้ Turnstile
  const turnstilePassed = !TURNSTILE_SITE_KEY || !!turnstileToken;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!turnstilePassed) {
      setError("กรุณารอการตรวจสอบสักครู่");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${LMS_API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "เกิดข้อผิดพลาด");
        turnstileRef.current?.reset();
        setTurnstileToken("");
        return;
      }
      router.push("/learn/login?registered=true");
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
        <Image
          src="/logo.svg"
          alt=""
          width={64}
          height={64}
          className="mx-auto rounded-xl"
        />
        <h1 className="text-2xl font-bold text-[var(--lms-accent-text)]">
          สมัครสมาชิก
        </h1>
        <p className="text-sm text-[var(--lms-text-secondary)]">
          สร้างบัญชีเพื่อเข้าเรียนคอร์สที่ซื้อแล้ว
        </p>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <input
            type="text"
            placeholder="ชื่อที่แสดง"
            value={form.displayName}
            onChange={set("displayName")}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />
          <input
            type="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={set("email")}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
            value={form.password}
            onChange={set("password")}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />
          <input
            type="password"
            placeholder="ยืนยันรหัสผ่าน"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />

          {TURNSTILE_SITE_KEY && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                options={{ theme: "auto", size: "flexible" }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !turnstilePassed}
            className="w-full rounded-lg bg-[var(--lms-accent)] py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>

        <p className="text-sm" style={{ color: "var(--lms-text-secondary)" }}>
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/learn/login" className="hover:underline" style={{ color: "var(--lms-accent-text)" }}>
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
