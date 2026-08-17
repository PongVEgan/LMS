import { learnPost } from "./learn-fetch";

export type UploadFolder = "course" | "community";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface SignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
}

/** ตรวจไฟล์ก่อนอัปโหลด — คืนข้อความ error ถ้าไม่ผ่าน */
export function validateImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return "รองรับเฉพาะไฟล์ JPG, PNG, WebP และ GIF";
  if (file.size > MAX_BYTES) return `ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024}MB`;
  return null;
}

/**
 * อัปโหลดรูปขึ้น Cloudinary แบบ signed direct upload
 * ขอลายเซ็นจาก backend ก่อน แล้วยิงไฟล์ตรงเข้า Cloudinary (ไม่ผ่าน API ของเรา)
 * onProgress คืนค่า 0-100 — ใช้ XHR เพราะ fetch ยังดู progress ของ upload ไม่ได้
 */
export async function uploadImage(
  file: File,
  folder: UploadFolder,
  onProgress?: (percent: number) => void
): Promise<string> {
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);

  const sigRes = await learnPost("/uploads/signature", { folder });
  if (!sigRes.ok) {
    const err = (await sigRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || "ขอลายเซ็นอัปโหลดไม่สำเร็จ");
  }
  const sig = (await sigRes.json()) as SignatureResponse;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data?.error?.message || `อัปโหลดไม่สำเร็จ (HTTP ${xhr.status})`));
      } catch {
        reject(new Error("Cloudinary ตอบกลับมาไม่ถูกรูปแบบ"));
      }
    };
    xhr.onerror = () => reject(new Error("เชื่อมต่อ Cloudinary ไม่ได้"));

    xhr.send(form);
  });
}
