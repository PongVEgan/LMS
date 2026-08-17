import { Router } from "express";
import { q } from "../db/pool.js";

/** เส้นทางสาธารณะ — ไม่ต้องล็อกอิน ใช้กับหน้าแรก (/) */
export const publicRouter = Router();

/** GET /public/courses — คอร์สที่เผยแพร่แล้ว พร้อมจำนวนบทเรียนและผู้เรียน */
publicRouter.get("/courses", async (_req, res) => {
  const rows = await q(`
    SELECT c.id, c.slug, c.title, c.description, c.cover_url, c.price,
           (SELECT count(*) FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
             WHERE ch.course_id = c.id)::int AS lesson_count,
           (SELECT coalesce(sum(l.duration), 0) FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
             WHERE ch.course_id = c.id)::int AS total_duration,
           (SELECT count(*) FROM enrollments WHERE course_id = c.id)::int AS student_count
      FROM courses c
     WHERE c.published = true
     ORDER BY c.created_at
  `);

  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      price: r.price,
      lessonCount: r.lesson_count,
      totalDuration: r.total_duration,
      studentCount: r.student_count,
    }))
  );
});

/**
 * GET /public/certificates/:code — ตรวจสอบเกียรติบัตร
 * เปิดสาธารณะเพื่อให้ HR หรือใครก็ได้เอาเลขที่มาเช็กว่าจริงไหม
 * คืนเฉพาะข้อมูลที่จำเป็นต่อการยืนยัน ไม่เปิดเผยอีเมลหรือข้อมูลติดต่อ
 */
publicRouter.get("/certificates/:code", async (req, res) => {
  const rows = await q(
    `SELECT ct.code, ct.issued_at, ct.quiz_percent,
            coalesce(u.display_name, split_part(u.email, '@', 1)) AS holder,
            c.title AS course_title
       FROM certificates ct
       JOIN users u ON u.id = ct.user_id
       JOIN courses c ON c.id = ct.course_id
      WHERE upper(ct.code) = upper($1)`,
    [req.params.code]
  );

  if (rows.length === 0) {
    return res.status(404).json({ valid: false, message: "ไม่พบเกียรติบัตรเลขที่นี้" });
  }

  const r = rows[0];
  res.json({
    valid: true,
    code: r.code,
    holder: r.holder,
    courseTitle: r.course_title,
    issuedAt: r.issued_at,
    quizPercent: r.quiz_percent,
  });
});

/** GET /public/stats — ตัวเลขไว้โชว์หน้าแรก */
publicRouter.get("/stats", async (_req, res) => {
  const rows = await q(`
    SELECT (SELECT count(*) FROM courses WHERE published)::int AS courses,
           (SELECT count(*) FROM lessons)::int                 AS lessons,
           (SELECT count(*) FROM users)::int                   AS students
  `);
  res.json(rows[0]);
});
