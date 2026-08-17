import Link from "next/link";
import Image from "next/image";
import { LMS_API, fetchWithTimeout } from "@/lib/fetch-utils";
import { SITE_NAME } from "@/lib/site";
import Certificate, { type CertificateData } from "@/components/Certificate";

// ตรวจสอบตอน request เสมอ ห้าม cache ผลเก่า
export const dynamic = "force-dynamic";

async function verify(code: string): Promise<CertificateData | null> {
  try {
    const res = await fetchWithTimeout(`${LMS_API}/public/certificates/${encodeURIComponent(code)}`, { cache: "no-store" }, 5000);
    if (!res.ok) return null;
    return (await res.json()) as CertificateData;
  } catch {
    return null;
  }
}

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await verify(code);

  return (
    <div className="min-h-screen" style={{ background: "var(--lms-bg)", color: "var(--lms-text)" }}>
      <header className="no-print" style={{ borderBottom: "1px solid var(--lms-border)" }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={24} height={24} className="rounded" />
            <span className="text-sm font-semibold" style={{ color: "var(--lms-accent-text)" }}>{SITE_NAME}</span>
          </Link>
          <span className="text-sm" style={{ color: "var(--lms-text-muted)" }}>· ตรวจสอบเกียรติบัตร</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {cert ? (
          <>
            <div className="no-print mb-5 flex items-center gap-3 rounded-xl p-4"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <span className="text-xl">✓</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--lms-green)" }}>เกียรติบัตรนี้เป็นของจริง</p>
                <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>
                  ออกโดย {SITE_NAME} · ข้อมูลตรงกับที่บันทึกไว้ในระบบ
                </p>
              </div>
            </div>
            <Certificate data={cert} />
          </>
        ) : (
          <div className="rounded-xl p-10 text-center"
            style={{ background: "var(--lms-bg-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-3xl">✕</p>
            <h1 className="mt-3 text-lg font-bold" style={{ color: "var(--lms-red)" }}>ไม่พบเกียรติบัตรเลขที่นี้</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--lms-text-muted)" }}>
              เลขที่ <code>{code}</code> ไม่มีอยู่ในระบบ — ตรวจสอบว่าพิมพ์ถูกต้องหรือไม่
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
