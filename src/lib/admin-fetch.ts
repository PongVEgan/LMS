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

/**
 * แปลงความยาวที่พิมพ์มาเป็น "จำนวนวินาที (จำนวนเต็มเสมอ)"
 *   "750"      → 750 วินาที
 *   "12:30"    → 750   (นาที:วินาที)
 *   "12.30"    → 750   (คนไทยพิมพ์จุดแทนโคลอนบ่อย)
 *   "1:02:03"  → 3723  (ชั่วโมง:นาที:วินาที)
 * อะไรที่แปลงไม่ได้ → 0 (ไม่ปล่อยค่าทศนิยมหรือ NaN ออกไป เพราะ DB รับแต่จำนวนเต็ม)
 */
export function parseDuration(input: string): number {
  const s = String(input ?? "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Number(s);

  const parts = s.split(/[:.]/).map((p) => Math.abs(Math.round(Number(p.trim()) || 0)));
  if (parts.length < 2 || parts.length > 3) return 0;

  const total = parts.reduce((sum, p) => sum * 60 + p, 0);
  return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
}

/** วินาที → "12:30" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
