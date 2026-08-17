"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";

export interface Attachment {
  id: string;
  url: string;
  name: string;
  size: number;
}

interface Props {
  attachments: Attachment[];
  /** อัปโหลดเสร็จแล้วให้ผูกกับบทเรียน (เรียก POST /admin/lessons/:id/attachments) */
  onAdd: (file: { url: string; name: string; size: number }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function AttachmentManager({ attachments, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setPercent(0);
    try {
      await onAdd(await uploadFile(file, "attachment", setPercent));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>
        ไฟล์ประกอบการเรียน
      </label>

      {attachments.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
              <svg className="h-4 w-4 shrink-0" style={{ color: "var(--lms-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <a href={a.url} target="_blank" rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-xs hover:underline" style={{ color: "var(--lms-text)" }}>
                {a.name}
              </a>
              <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "var(--lms-text-faint)" }}>
                {formatBytes(a.size)}
              </span>
              <button type="button" onClick={() => confirm(`ลบไฟล์ "${a.name}"?`) && onRemove(a.id)}
                className="shrink-0 text-xs hover:underline" style={{ color: "var(--lms-red)" }}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="w-full rounded-lg py-2 text-xs transition hover:opacity-80 disabled:opacity-60"
        style={{ border: "1px dashed var(--lms-border)", color: "var(--lms-text-muted)" }}>
        {uploading ? `กำลังอัปโหลด ${percent}%` : "+ เพิ่มไฟล์ (PDF, Word, Excel, ZIP, รูป — ไม่เกิน 20MB)"}
      </button>

      <input ref={inputRef} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="mt-1.5 text-xs" style={{ color: "var(--lms-red)" }}>{error}</p>}
    </div>
  );
}
