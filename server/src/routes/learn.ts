import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { requireUser } from "../lib/user.js";
import { checkCourseCompletion } from "../lib/completion.js";

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
    "SELECT id, url, name, size FROM attachments WHERE lesson_id = $1 ORDER BY sort_order, created_at",
    [lesson.id]
  );

  // ความคืบหน้าของผู้เรียนคนนี้ — ใช้เล่นต่อจากจุดเดิม
  const prog = await q1(
    "SELECT completed, position_seconds, watched_percent FROM progress WHERE user_id = $1 AND lesson_id = $2",
    [req.user!.id, lesson.id]
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
    progress: {
      completed: prog?.completed ?? false,
      position: prog?.position_seconds ?? 0,
      watchedPercent: prog?.watched_percent ?? 0,
    },
  });
});

/**
 * POST /learn/progress
 *   { lessonId, completed }                          → ติ๊กว่าเรียนจบ (ปุ่มกดเอง)
 *   { lessonId, position, watchedPercent, watched }  → บันทึกตำแหน่งวิดีโอระหว่างดู
 *
 * watchedPercent เก็บเป็นค่าสูงสุดที่เคยดูถึง (ถอยกลับไปดูซ้ำไม่ทำให้ลดลง)
 * ถึง 90% เมื่อไหร่ระบบติ๊กว่าเรียนจบให้เอง
 */
learnRouter.post("/progress", async (req, res) => {
  const { lessonId, completed, position, watchedPercent, watched, duration } = req.body ?? {};
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

  // เครื่องเล่นรู้ความยาวจริงจาก YouTube — ถ้าแอดมินยังไม่ได้กรอก เติมให้เลย
  // (เขียนทับเฉพาะตอนที่ยังเป็น 0 จะได้ไม่ไปทับค่าที่แอดมินตั้งใจใส่เอง)
  const realDuration = Math.max(0, Math.round(Number(duration) || 0));
  if (realDuration > 0) {
    await q("UPDATE lessons SET duration = $1 WHERE id = $2 AND duration = 0", [realDuration, lessonId]);
  }

  const AUTO_COMPLETE_AT = 90; // % ที่ถือว่าเรียนจบแล้ว
  const percent = Math.max(0, Math.min(100, Math.round(Number(watchedPercent) || 0)));
  const pos = Math.max(0, Math.round(Number(position) || 0));
  const watchedSec = Math.max(0, Math.round(Number(watched) || 0));

  // กดปุ่ม "เรียนจบแล้ว" เอง หรือดูถึงเกณฑ์
  const markComplete = completed === true || percent >= AUTO_COMPLETE_AT;

  const row = await q1(
    `INSERT INTO progress (user_id, lesson_id, completed, completed_at,
                           position_seconds, watched_percent, watched_seconds, last_seen_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END, $4, $5, $6, now())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       -- จบแล้วไม่ถอยกลับเป็นยังไม่จบ นอกจากส่ง completed:false มาตรงๆ
       completed        = CASE WHEN $7 THEN false ELSE progress.completed OR EXCLUDED.completed END,
       completed_at     = CASE WHEN $7 THEN NULL
                               WHEN progress.completed THEN progress.completed_at
                               ELSE EXCLUDED.completed_at END,
       position_seconds = EXCLUDED.position_seconds,
       watched_percent  = greatest(progress.watched_percent, EXCLUDED.watched_percent),
       watched_seconds  = progress.watched_seconds + EXCLUDED.watched_seconds,
       last_seen_at     = now()
     RETURNING completed, watched_percent, position_seconds`,
    [req.user!.id, lessonId, markComplete, pos, percent, watchedSec, completed === false]
  );

  // เรียนจบบทนี้แล้วอาจจะจบทั้งคอร์สพอดี — เช็กและออกเกียรติบัตรให้ตรงนี้
  // (ไม่ได้เช็กแค่ตอนส่งข้อสอบ เพราะคอร์สที่ไม่มีข้อสอบจะไม่มีวันได้เกียรติบัตรเลย)
  const completion = row!.completed ? await checkCourseCompletion(req.user!.id, lesson.course_id) : null;

  res.json({
    ok: true,
    completed: row!.completed,
    watchedPercent: row!.watched_percent,
    position: row!.position_seconds,
    certificateCode: completion?.certificateCode ?? null,
  });
});
