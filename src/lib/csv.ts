/**
 * แปลงข้อมูลเป็น CSV แล้วสั่งดาวน์โหลด
 * ใส่ BOM ไว้ข้างหน้าเพราะ Excel บน Windows อ่านภาษาไทยไม่ออกถ้าไม่มี
 */
export function downloadCsv<T extends object>(
  filename: string,
  columns: { key: string; label: string }[],
  rows: T[]
) {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    // ครอบด้วยเครื่องหมายคำพูดเมื่อมี , " หรือขึ้นบรรทัดใหม่ และ escape " เป็น ""
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    columns.map((c) => escape(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => escape((row as Record<string, unknown>)[c.key])).join(",")),
  ];

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** วันที่แบบอ่านง่ายสำหรับใส่ใน CSV */
export function csvDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}
