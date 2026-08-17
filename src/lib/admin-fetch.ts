import { learnFetch, learnPost, learnPut, learnDelete } from "./learn-fetch";

/**
 * ยิง /admin/* — ใช้ helper ชุดเดียวกับฝั่ง learn (แนบ header x-user-email ให้อัตโนมัติ)
 * ทุกเส้นฝั่ง backend ผ่าน requireAdmin อยู่แล้ว
 */
export const adminGet = (path: string) => learnFetch(`/admin${path}`);
export const adminPost = (path: string, body: unknown = {}) => learnPost(`/admin${path}`, body);
export const adminPut = (path: string, body: unknown = {}) => learnPut(`/admin${path}`, body);
export const adminDelete = (path: string) => learnDelete(`/admin${path}`);

/** อ่าน JSON พร้อมโยน error ที่มีข้อความจาก backend ให้หน้าเว็บเอาไปโชว์ */
export async function adminJson<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** "12:30" หรือ "750" → วินาที */
export function parseDuration(input: string): number {
  const s = input.trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map((p) => Number(p) || 0);
  return parts.reduce((total, p) => total * 60 + p, 0);
}

/** วินาที → "12:30" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
