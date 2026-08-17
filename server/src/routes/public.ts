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

/** GET /public/stats — ตัวเลขไว้โชว์หน้าแรก */
publicRouter.get("/stats", async (_req, res) => {
  const rows = await q(`
    SELECT (SELECT count(*) FROM courses WHERE published)::int AS courses,
           (SELECT count(*) FROM lessons)::int                 AS lessons,
           (SELECT count(*) FROM users)::int                   AS students
  `);
  res.json(rows[0]);
});
