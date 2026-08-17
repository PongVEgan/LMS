import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { requireUser } from "../lib/user.js";

export const learnRouter = Router();
learnRouter.use(requireUser);

/** GET /learn/my-courses — คอร์สที่มีสิทธิ์เรียน พร้อม progress */
learnRouter.get("/my-courses", async (req, res) => {
  const rows = await q(
    `SELECT c.id, c.slug, c.title, c.description, c.cover_url,
            count(l.id)::int AS total,
            count(p.lesson_id) FILTER (WHERE p.completed)::int AS completed
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN chapters ch ON ch.course_id = c.id
       LEFT JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
      WHERE e.user_id = $1 AND e.status = 'active'
      GROUP BY c.id, e.enrolled_at
      ORDER BY e.enrolled_at DESC`,
    [req.user!.id]
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      progress: {
        total: r.total,
        completed: r.completed,
        percent: r.total ? Math.round((r.completed / r.total) * 100) : 0,
      },
    }))
  );
});

/** GET /learn/catalog — คอร์สทั้งหมดที่เปิดขาย (frontend กรองตัวที่ซื้อแล้วออกเอง) */
learnRouter.get("/catalog", async (_req, res) => {
  const rows = await q(
    `SELECT id, slug, title, description, cover_url, price
       FROM courses WHERE published = true ORDER BY created_at`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      price: r.price,
    }))
  );
});

/** GET /learn/courses/:slug — โครงสร้างคอร์ส + สถานะเรียนจบรายบท */
learnRouter.get("/courses/:slug", async (req, res) => {
  const course = await q1(
    `SELECT c.id, c.slug, c.title, c.description, c.cover_url
       FROM courses c WHERE c.slug = $1`,
    [req.params.slug]
  );
  if (!course) return res.status(404).json({ message: "ไม่พบคอร์สนี้" });

  const enrolled = await q1(
    "SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [req.user!.id, course.id]
  );
  if (!enrolled) return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้" });

  const rows = await q(
    `SELECT ch.id AS chapter_id, ch.title AS chapter_title, ch.sort_order AS chapter_order,
            l.id, l.title, l.description, l.duration, l.sort_order, l.type,
            coalesce(p.completed, false) AS completed
       FROM chapters ch
       LEFT JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = $2
      WHERE ch.course_id = $1
      ORDER BY ch.sort_order, l.sort_order`,
    [course.id, req.user!.id]
  );

  const chapters: any[] = [];
  for (const r of rows) {
    let chapter = chapters.find((c) => c.id === r.chapter_id);
    if (!chapter) {
      chapter = { id: r.chapter_id, title: r.chapter_title, order: r.chapter_order, lessons: [] };
      chapters.push(chapter);
    }
    if (r.id) {
      chapter.lessons.push({
        id: r.id,
        title: r.title,
        description: r.description,
        duration: r.duration,
        order: r.sort_order,
        type: r.type,
        completed: r.completed,
      });
    }
  }

  res.json({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    coverUrl: course.cover_url,
    chapters,
  });
});

/** GET /learn/lessons/:id */
learnRouter.get("/lessons/:id", async (req, res) => {
  const lesson = await q1(
    `SELECT l.*, ch.course_id
       FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
      WHERE l.id = $1`,
    [req.params.id]
  );
  if (!lesson) return res.status(404).json({ message: "ไม่พบบทเรียน" });

  const enrolled = await q1(
    "SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [req.user!.id, lesson.course_id]
  );
  if (!enrolled && !lesson.is_free) {
    return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนบทเรียนนี้" });
  }

  const attachments = await q(
    "SELECT id, url, name, size FROM attachments WHERE lesson_id = $1 ORDER BY name",
    [lesson.id]
  );

  res.json({
    id: lesson.id,
    chapterId: lesson.chapter_id,
    courseId: lesson.course_id,
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    content: lesson.content,
    videoUrl: lesson.video_url,
    duration: lesson.duration,
    order: lesson.sort_order,
    isFree: lesson.is_free,
    attachments,
  });
});

/** POST /learn/progress — { lessonId, completed } */
learnRouter.post("/progress", async (req, res) => {
  const { lessonId, completed } = req.body ?? {};
  if (!lessonId) return res.status(400).json({ message: "ไม่พบ lessonId" });

  const lesson = await q1(
    `SELECT ch.course_id FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id WHERE l.id = $1`,
    [lessonId]
  );
  if (!lesson) return res.status(404).json({ message: "ไม่พบบทเรียน" });

  const enrolled = await q1(
    "SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [req.user!.id, lesson.course_id]
  );
  if (!enrolled) return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้" });

  await q(
    `INSERT INTO progress (user_id, lesson_id, completed, completed_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END)
     ON CONFLICT (user_id, lesson_id)
     DO UPDATE SET completed = EXCLUDED.completed, completed_at = EXCLUDED.completed_at`,
    [req.user!.id, lessonId, completed !== false]
  );

  res.json({ ok: true });
});
