import type { Request, Response, NextFunction } from "express";
import { q1 } from "../db/pool.js";

export interface DbUser {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  phone: string | null;
  line_id: string | null;
  role: "user" | "admin";
  bio: string;
  business_name: string;
  industry: string;
  province: string;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: DbUser;
    }
  }
}

export function findUserByEmail(email: string) {
  return q1<DbUser>("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
}

/**
 * frontend ระบุตัวตนด้วย header x-user-email (ดู src/lib/learn-fetch.ts ฝั่ง web)
 * dev เท่านั้น — ของจริงควรเปลี่ยนเป็น JWT แล้ว verify ตรงนี้
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const email = String(req.header("x-user-email") || req.query.email || "");
  if (!email) return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ message: "ไม่พบบัญชีผู้ใช้นี้" });

  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "ต้องเป็นแอดมินเท่านั้น" });
  next();
}

/** แต้ม 100 = 1 เลเวล สูงสุด 5 */
export function levelFromPoints(points: number): number {
  return Math.max(1, Math.min(5, Math.floor(points / 100) + 1));
}
