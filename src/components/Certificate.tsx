"use client";

import { SITE_NAME } from "@/lib/site";

export interface CertificateData {
  code: string;
  holder: string;
  courseTitle: string;
  issuedAt: string;
  quizPercent: number | null;
}

/**
 * ใบเกียรติบัตร — ออกแบบให้พิมพ์ออกมาแล้วสวย (Ctrl+P บันทึกเป็น PDF ได้เลย)
 * สีพื้นและตัวอักษรตายตัว ไม่ตามธีม light/dark เพราะต้องพิมพ์ลงกระดาษขาว
 */
export default function Certificate({ data }: { data: CertificateData }) {
  const issued = new Date(data.issuedAt).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="cert mx-auto w-full max-w-3xl"
      style={{
        background: "#fffdf7",
        color: "#1a1a19",
        border: "10px double #d4af37",
        padding: "clamp(24px, 6vw, 56px)",
        textAlign: "center",
        fontFamily: '"Prompt", sans-serif',
      }}
    >
      <p style={{ letterSpacing: "0.3em", fontSize: 12, color: "#8a7a3a" }}>{SITE_NAME.toUpperCase()}</p>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 38px)", fontWeight: 700, margin: "12px 0 4px" }}>
        เกียรติบัตร
      </h1>
      <p style={{ fontSize: 13, color: "#6b6455" }}>Certificate of Completion</p>

      <div style={{ width: 64, height: 2, background: "#d4af37", margin: "20px auto" }} />

      <p style={{ fontSize: 14, color: "#6b6455" }}>ขอมอบเกียรติบัตรฉบับนี้ให้แก่</p>
      <p style={{ fontSize: "clamp(22px, 4.5vw, 34px)", fontWeight: 600, margin: "10px 0 6px" }}>
        {data.holder}
      </p>
      <p style={{ fontSize: 14, color: "#6b6455" }}>ผู้สำเร็จการเรียนหลักสูตร</p>
      <p style={{ fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 600, margin: "8px 0 0", color: "#8a6d1f" }}>
        {data.courseTitle}
      </p>

      {data.quizPercent !== null && (
        <p style={{ fontSize: 13, color: "#6b6455", marginTop: 10 }}>
          ผลการทดสอบเฉลี่ย {data.quizPercent}%
        </p>
      )}

      <div style={{ width: 64, height: 2, background: "#d4af37", margin: "24px auto" }} />

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#6b6455" }}>
        <span>ออกให้ ณ วันที่ {issued}</span>
        <span style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>เลขที่ {data.code}</span>
      </div>

      <p style={{ marginTop: 18, fontSize: 11, color: "#9a9484" }}>
        ตรวจสอบความถูกต้องได้ที่หน้า &quot;ตรวจสอบเกียรติบัตร&quot; ด้วยเลขที่ข้างต้น
      </p>
    </div>
  );
}
