"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LMS_API } from "@/lib/fetch-utils";
import Certificate, { type CertificateData } from "@/components/Certificate";

export default function CertificateViewPage() {
  const { code } = useParams<{ code: string }>();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // ใช้เส้นสาธารณะ เจ้าของเกียรติบัตรหรือใครเปิดก็เห็นเหมือนกัน
    fetch(`${LMS_API}/public/certificates/${code}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "ไม่พบเกียรติบัตร");
        return d as CertificateData;
      })
      .then(setCert)
      .catch((e) => setError(e.message));
  }, [code]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm" style={{ color: "var(--lms-red)" }}>{error}</p>
        <Link href="/learn/certificates" className="mt-3 inline-block text-sm hover:underline"
          style={{ color: "var(--lms-accent-text)" }}>
          กลับหน้าเกียรติบัตร
        </Link>
      </div>
    );
  }

  if (!cert) return <div className="p-6 text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</div>;

  return (
    <div className="cert-page mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/learn/certificates" className="text-xs hover:underline" style={{ color: "var(--lms-text-muted)" }}>
          ← เกียรติบัตรทั้งหมด
        </Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            style={{ background: "var(--lms-accent)" }}>
            พิมพ์ / บันทึกเป็น PDF
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/verify/${cert.code}`);
              alert("คัดลอกลิงก์ตรวจสอบแล้ว");
            }}
            className="rounded-lg px-4 py-2 text-sm transition hover:opacity-80"
            style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
            คัดลอกลิงก์ตรวจสอบ
          </button>
        </div>
      </div>

      <Certificate data={cert} />

      <p className="no-print mt-4 text-center text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
        ส่งลิงก์ <code>/verify/{cert.code}</code> ให้ผู้อื่นตรวจสอบได้โดยไม่ต้องล็อกอิน
      </p>
    </div>
  );
}
