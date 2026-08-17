"use client";

import { SessionProvider, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/admin", label: "ภาพรวม", exact: true },
  { href: "/admin/courses", label: "คอร์ส" },
  { href: "/admin/students", label: "ผู้เรียน" },
  { href: "/admin/orders", label: "คำสั่งซื้อ" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  // เมนูมือถือปิดเองตอนกดลิงก์ (onClick ของแต่ละ Link) จึงไม่ต้องมี effect คอยรีเซ็ต
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status === "loading") {
    return (
      <div data-theme="dark" className="flex min-h-screen items-center justify-center" style={{ background: "var(--lms-bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // middleware กันไว้อีกชั้นแล้ว อันนี้กันกรณี session หมดอายุระหว่างใช้งาน
  if (role !== "admin") {
    return (
      <div data-theme="dark" className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--lms-text-secondary)" }}>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link href="/learn" className="mt-3 inline-block text-sm hover:underline" style={{ color: "var(--lms-accent-text)" }}>
            กลับหน้าเรียน
          </Link>
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="space-y-1 p-3">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm transition"
            style={{
              background: active ? "var(--lms-accent-bg)" : "transparent",
              color: active ? "var(--lms-accent-text)" : "var(--lms-text-secondary)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/learn"
        className="mt-4 block rounded-lg px-3 py-2 text-xs transition hover:opacity-80"
        style={{ color: "var(--lms-text-muted)" }}
      >
        ← กลับหน้าเรียน
      </Link>
    </nav>
  );

  return (
    <div data-theme="dark" style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>
      {/* Mobile */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 backdrop-blur-md"
          style={{ background: "var(--lms-topbar)", borderBottom: "1px solid var(--lms-border)" }}>
          <button onClick={() => setMobileOpen((v) => !v)} className="rounded p-1.5" style={{ color: "var(--lms-text-muted)" }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME} Admin</span>
          <div className="w-8" />
        </div>
        {mobileOpen && <div style={{ borderBottom: "1px solid var(--lms-border)" }}>{nav}</div>}
        <main className="min-h-screen w-full overflow-x-hidden">{children}</main>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex lg:h-screen">
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto"
          style={{ background: "var(--lms-bg-secondary)", borderRight: "1px solid var(--lms-border)" }}>
          <div className="flex h-14 items-center gap-2 px-4 shrink-0" style={{ borderBottom: "1px solid var(--lms-border)" }}>
            <Image src="/logo.svg" alt="" width={24} height={24} className="rounded" />
            <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME} Admin</span>
          </div>
          {nav}
          <div className="mt-auto p-3 text-[11px]" style={{ borderTop: "1px solid var(--lms-border)", color: "var(--lms-text-faint)" }}>
            {session?.user?.email}
          </div>
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
