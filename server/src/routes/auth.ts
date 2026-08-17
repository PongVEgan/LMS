import { Router } from "express";
import { randomBytes } from "node:crypto";
import { q, q1 } from "../db/pool.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { findUserByEmail } from "../lib/user.js";

export const authRouter = Router();

/** POST /auth/login — next-auth Credentials provider เรียกจาก server ฝั่ง web */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "กรอกอีเมลและรหัสผ่าน" });

  const user = await findUserByEmail(String(email));
  if (!user || !(await verifyPassword(String(password), user.password_hash))) {
    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  res.json({ userId: user.id, email: user.email, displayName: user.display_name });
});

/** POST /auth/register */
authRouter.post("/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  const displayName = String(req.body?.displayName ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: "อีเมลไม่ถูกต้อง" });
  if (password.length < 6) return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  if (await findUserByEmail(email)) return res.status(409).json({ message: "อีเมลนี้ถูกใช้งานแล้ว" });

  const user = await q1<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [email, await hashPassword(password), displayName || null]
  );

  res.status(201).json({ userId: user!.id, email, displayName });
});

/** GET /auth/check-enrollment?email= — ฝั่ง web เอา role ไปใส่ JWT */
authRouter.get("/check-enrollment", async (req, res) => {
  const user = await findUserByEmail(String(req.query.email ?? ""));
  res.json({ role: user?.role ?? "user" });
});

/** POST /auth/forgot-password — ตอบ 200 เสมอ ไม่บอกว่าอีเมลมีอยู่จริงไหม */
authRouter.post("/forgot-password", async (req, res) => {
  const user = await findUserByEmail(String(req.body?.email ?? ""));
  if (user) {
    const token = randomBytes(32).toString("hex");
    await q(
      `INSERT INTO password_resets (token, user_id, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [token, user.id]
    );
    // dev: ยังไม่ส่งอีเมลจริง — ปริ้นลิงก์ให้ก๊อปจาก terminal
    const web = process.env.CORS_ORIGIN || "http://localhost:3000";
    console.log(`\n[reset password] ${user.email}\n  ${web}/learn/reset-password?token=${token}\n`);
  }
  res.json({ ok: true });
});

/** POST /auth/reset-password */
authRouter.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  if (password.length < 6) return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  const row = await q1<{ user_id: string }>(
    `SELECT user_id FROM password_resets
     WHERE token = $1 AND used = false AND expires_at > now()`,
    [token]
  );
  if (!row) return res.status(400).json({ message: "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว" });

  await q("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), row.user_id]);
  await q("UPDATE password_resets SET used = true WHERE token = $1", [token]);

  res.json({ ok: true });
});

/** GET /auth/profile?email= */
authRouter.get("/profile", async (req, res) => {
  const email = String(req.header("x-user-email") || req.query.email || "");
  const user = await findUserByEmail(email);
  if (!user) return res.status(404).json({ message: "ไม่พบบัญชีผู้ใช้นี้" });

  const courses = await q(
    `SELECT c.title, c.slug, e.customer_code, e.status, e.enrolled_at,
            count(l.id)::int AS total_lessons,
            count(p.lesson_id) FILTER (WHERE p.completed)::int AS completed_lessons
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN chapters ch ON ch.course_id = c.id
       LEFT JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
      WHERE e.user_id = $1
      GROUP BY c.title, c.slug, e.customer_code, e.status, e.enrolled_at
      ORDER BY e.enrolled_at DESC`,
    [user.id]
  );

  res.json({
    email: user.email,
    displayName: user.display_name,
    phone: user.phone,
    lineId: user.line_id,
    hasPassword: !!user.password_hash,
    createdAt: user.created_at,
    courses: courses.map((c) => ({
      title: c.title,
      slug: c.slug,
      customerCode: c.customer_code,
      status: c.status,
      enrolledAt: c.enrolled_at,
      totalLessons: c.total_lessons,
      completedLessons: c.completed_lessons,
      percent: c.total_lessons ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0,
    })),
  });
});

/**
 * POST /auth/update-profile — ใช้ 2 แบบ
 *  - { email, displayName, phone, lineId }        แก้ข้อมูลทั่วไป
 *  - { email, currentPassword, newPassword }      เปลี่ยนรหัสผ่าน
 */
authRouter.post("/update-profile", async (req, res) => {
  const email = String(req.header("x-user-email") || req.body?.email || "");
  const user = await findUserByEmail(email);
  if (!user) return res.status(404).json({ message: "ไม่พบบัญชีผู้ใช้นี้" });

  const { currentPassword, newPassword, displayName, phone, lineId } = req.body ?? {};

  if (newPassword !== undefined) {
    if (String(newPassword).length < 6) return res.status(400).json({ message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
    if (!(await verifyPassword(String(currentPassword ?? ""), user.password_hash))) {
      return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }
    await q("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(String(newPassword)), user.id]);
    return res.json({ ok: true });
  }

  await q(
    `UPDATE users
        SET display_name = COALESCE($1, display_name),
            phone        = COALESCE($2, phone),
            line_id      = COALESCE($3, line_id)
      WHERE id = $4`,
    [displayName ?? null, phone ?? null, lineId ?? null, user.id]
  );

  res.json({ ok: true });
});
