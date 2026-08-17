"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useState, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { SITE_NAME, TURNSTILE_SITE_KEY } from "@/lib/site";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const isNotEnrolled = error === "not_enrolled";
  const isRegistered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);
  // ไม่ได้ตั้ง site key = ไม่ใช้ Turnstile
  const turnstilePassed = !TURNSTILE_SITE_KEY || !!turnstileToken;

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstilePassed) {
      setCredError("กรุณารอการตรวจสอบสักครู่");
      return;
    }
    setLoading(true);
    setCredError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setCredError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } else {
      window.location.href = "/learn";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center lms-bg px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Image
          src="/logo.svg"
          alt=""
          width={64}
          height={64}
          className="mx-auto rounded-xl"
        />
        <h1 className="text-2xl font-bold text-[var(--lms-accent-text)]">
          {SITE_NAME}
        </h1>
        {isRegistered && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-sm text-green-400">
              สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ
            </p>
          </div>
        )}

        {isNotEnrolled && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">
              อีเมลนี้ยังไม่ได้ซื้อคอร์ส
            </p>
            <Link
              href="/learn"
              className="mt-3 inline-block rounded-lg bg-[var(--lms-accent)] px-5 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              ดูคอร์สทั้งหมด
            </Link>
          </div>
        )}

        {error && !isNotEnrolled && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">
              เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
            </p>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-3 text-left">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--lms-border-input)] bg-[var(--lms-bg-input)] px-4 py-3 text-sm text-[var(--lms-text)] placeholder:text-[var(--lms-text-muted)] focus:border-[var(--lms-accent)] focus:outline-none"
          />

          <div className="text-right">
            <Link href="/learn/forgot-password" className="text-xs text-[var(--lms-text-muted)] hover:text-[var(--lms-text-secondary)]">
              ลืมรหัสผ่าน?
            </Link>
          </div>

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

          {credError && (
            <p className="text-xs text-red-400">{credError}</p>
          )}
          <button
            type="submit"
            disabled={loading || !turnstilePassed}
            className="w-full rounded-lg bg-[var(--lms-accent)] py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-sm text-[var(--lms-text-secondary)]">
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/learn/register"
            className="text-[var(--lms-accent-text)] hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
