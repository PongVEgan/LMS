"use client";

import { useRef, useState } from "react";
import { uploadImage, type UploadFolder } from "@/lib/upload";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: UploadFolder;
  label?: string;
  /** ทรงกรอบพรีวิว — cover ใช้กับรูปปกคอร์ส, wide ใช้กับรูปในโพสต์ */
  aspect?: "cover" | "wide";
}

export default function ImageUpload({ value, onChange, folder, label, aspect = "cover" }: Props) {
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
      onChange(await uploadImage(file, folder, setPercent));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ""; // ให้เลือกไฟล์เดิมซ้ำได้
    }
  };

  return (
    <div>
      {label && <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>{label}</label>}

      {value ? (
        <div className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--lms-border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className={`w-full object-cover ${aspect === "cover" ? "h-40" : "max-h-72"}`} />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="rounded-md px-2.5 py-1 text-xs backdrop-blur"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
              เปลี่ยนรูป
            </button>
            <button type="button" onClick={() => onChange(null)}
              className="rounded-md px-2.5 py-1 text-xs backdrop-blur"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fca5a5" }}>
              ลบ
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg py-6 transition hover:opacity-80 disabled:opacity-60"
          style={{ border: "1px dashed var(--lms-border)", color: "var(--lms-text-muted)" }}
        >
          {uploading ? (
            <>
              <div className="h-1.5 w-32 overflow-hidden rounded-full" style={{ background: "var(--lms-border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "var(--lms-accent)" }} />
              </div>
              <span className="text-xs">กำลังอัปโหลด {percent}%</span>
            </>
          ) : (
            <>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 16.5V18a3 3 0 003 3h12a3 3 0 003-3v-1.5M7.5 9L12 4.5m0 0L16.5 9M12 4.5V16" />
              </svg>
              <span className="text-xs">เลือกรูปเพื่ออัปโหลด</span>
              <span className="text-[10px]" style={{ color: "var(--lms-text-faint)" }}>JPG · PNG · WebP · GIF ไม่เกิน 5MB</span>
            </>
          )}
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => pick(e.target.files?.[0])} />

      {error && <p className="mt-1.5 text-xs" style={{ color: "var(--lms-red)" }}>{error}</p>}
    </div>
  );
}
