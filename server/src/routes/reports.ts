import { Router } from "express";
import { q } from "../db/pool.js";
import { requireAdmin, requireUser } from "../lib/user.js";

/** รายงานสำหรับผู้ดูแล — ทุกเส้นรับช่วงเวลา ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const reportRouter = Router();
reportRouter.use(requireUser, requireAdmin);

/** ไม่ส่งช่วงเวลามา = ย้อนหลัง 30 วัน · to นับรวมทั้งวัน */
function range(req: { query: Record<string, unknown> }) {
  const to = String(req.query.to || "").match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(req.query.to)
    : new Date().toISOString().slice(0, 10);
  const from = String(req.query.from || "").match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(req.query.from)
    : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

/** GET /admin/reports/overview — ตัวเลขสรุปในช่วงเวลา + ยอดขาย */
reportRouter.get("/overview", async (req, res) => {
  const { from, to } = range(req);

  const rows = await q(
    `SELECT
       (SELECT count(*) FROM users WHERE created_at::date BETWEEN $1 AND $2)::int              AS new_users,
       (SELECT count(*) FROM enrollments WHERE enrolled_at::date BETWEEN $1 AND $2)::int       AS new_enrollments,
       (SELECT count(*) FROM orders WHERE status = 'paid' AND paid_at::date BETWEEN $1 AND $2)::int AS paid_orders,
       (SELECT coalesce(sum(amount), 0) FROM orders WHERE status = 'paid' AND paid_at::date BETWEEN $1 AND $2)::int AS revenue,
       (SELECT count(*) FROM orders WHERE status = 'awaiting_review')::int                     AS awaiting_orders,
       (SELECT count(*) FROM progress WHERE completed AND completed_at::date BETWEEN $1 AND $2)::int AS lessons_completed,
       (SELECT count(*) FROM quiz_attempts WHERE submitted_at::date BETWEEN $1 AND $2)::int    AS quiz_attempts,
       (SELECT count(*) FROM quiz_attempts WHERE passed AND submitted_at::date BETWEEN $1 AND $2)::int AS quiz_passed,
       (SELECT count(*) FROM certificates WHERE issued_at::date BETWEEN $1 AND $2)::int        AS certificates`,
    [from, to]
  );

  const daily = await q(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            (SELECT count(*) FROM users WHERE created_at::date = d.day)::int AS users,
            (SELECT coalesce(sum(amount), 0) FROM orders WHERE status = 'paid' AND paid_at::date = d.day)::int AS revenue
       FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
      ORDER BY d.day`,
    [from, to]
  );

  const r = rows[0];
  res.json({
    from,
    to,
    newUsers: r.new_users,
    newEnrollments: r.new_enrollments,
    paidOrders: r.paid_orders,
    revenue: r.revenue,
    awaitingOrders: r.awaiting_orders,
    lessonsCompleted: r.lessons_completed,
    quizAttempts: r.quiz_attempts,
    quizPassed: r.quiz_passed,
    certificates: r.certificates,
    daily,
  });
});

/** GET /admin/reports/courses — สรุปรายคอร์ส */
reportRouter.get("/courses", async (req, res) => {
  const { from, to } = range(req);

  const rows = await q(
    `SELECT c.id, c.title, c.slug, c.price,
            (SELECT count(*) FROM enrollments WHERE course_id = c.id)::int AS students,
            (SELECT count(*) FROM enrollments WHERE course_id = c.id AND enrolled_at::date BETWEEN $1 AND $2)::int AS new_students,
            (SELECT count(*) FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id WHERE ch.course_id = c.id)::int AS lessons,
            (SELECT coalesce(sum(o.amount), 0) FROM orders o
              WHERE o.course_id = c.id AND o.status = 'paid' AND o.paid_at::date BETWEEN $1 AND $2)::int AS revenue,
            (SELECT count(*) FROM certificates WHERE course_id = c.id)::int AS certificates,
            coalesce((
              SELECT round(avg(sub.percent))::int FROM (
                SELECT CASE WHEN lc.total = 0 THEN 0 ELSE 100.0 * lc.done / lc.total END AS percent
                  FROM enrollments e
                  CROSS JOIN LATERAL (
                    SELECT count(l.id) AS total,
                           count(p.lesson_id) FILTER (WHERE p.completed) AS done
                      FROM chapters ch
                      JOIN lessons l ON l.chapter_id = ch.id
                      LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
                     WHERE ch.course_id = c.id
                  ) lc
                 WHERE e.course_id = c.id
              ) sub
            ), 0) AS avg_progress,
            (SELECT round(avg(a.percent))::int FROM quiz_attempts a
               JOIN quizzes z ON z.id = a.quiz_id
               JOIN lessons l ON l.id = z.lesson_id
               JOIN chapters ch ON ch.id = l.chapter_id
              WHERE ch.course_id = c.id AND a.submitted_at IS NOT NULL) AS avg_quiz
       FROM courses c
      ORDER BY students DESC, c.title`,
    [from, to]
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      price: r.price,
      students: r.students,
      newStudents: r.new_students,
      lessons: r.lessons,
      revenue: r.revenue,
      certificates: r.certificates,
      avgProgress: r.avg_progress,
      avgQuiz: r.avg_quiz,
    }))
  );
});

/** GET /admin/reports/students?courseId= — ความคืบหน้ารายคน (ใช้ทำ CSV) */
reportRouter.get("/students", async (req, res) => {
  const courseId = String(req.query.courseId || "");

  const rows = await q(
    `SELECT u.email, coalesce(u.display_name, '') AS name, c.title AS course_title,
            e.enrolled_at,
            lc.total::int AS total_lessons,
            lc.done::int  AS completed_lessons,
            CASE WHEN lc.total = 0 THEN 0 ELSE round(100.0 * lc.done / lc.total)::int END AS percent,
            (SELECT round(avg(best.percent))::int FROM (
                SELECT max(a.percent) AS percent
                  FROM quiz_attempts a
                  JOIN quizzes z ON z.id = a.quiz_id
                  JOIN lessons l2 ON l2.id = z.lesson_id
                  JOIN chapters ch2 ON ch2.id = l2.chapter_id
                 WHERE ch2.course_id = c.id AND a.user_id = u.id AND a.submitted_at IS NOT NULL
                 GROUP BY z.id
             ) best) AS quiz_percent,
            (SELECT code FROM certificates WHERE user_id = u.id AND course_id = c.id) AS certificate
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       CROSS JOIN LATERAL (
         SELECT count(l.id) AS total, count(p.lesson_id) FILTER (WHERE p.completed) AS done
           FROM chapters ch
           JOIN lessons l ON l.chapter_id = ch.id
           LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = u.id
          WHERE ch.course_id = c.id
       ) lc
      WHERE ($1 = '' OR c.id::text = $1)
      ORDER BY c.title, percent DESC, u.email`,
    [courseId]
  );

  res.json(
    rows.map((r) => ({
      email: r.email,
      name: r.name,
      courseTitle: r.course_title,
      enrolledAt: r.enrolled_at,
      totalLessons: r.total_lessons,
      completedLessons: r.completed_lessons,
      percent: r.percent,
      quizPercent: r.quiz_percent,
      certificate: r.certificate,
    }))
  );
});

/** GET /admin/reports/orders — ยอดขายรายรายการในช่วงเวลา (ใช้ทำ CSV) */
reportRouter.get("/orders", async (req, res) => {
  const { from, to } = range(req);
  const rows = await q(
    `SELECT o.reference, o.amount, o.method, o.status, o.created_at, o.paid_at,
            u.email, c.title AS course_title
       FROM orders o JOIN users u ON u.id = o.user_id JOIN courses c ON c.id = o.course_id
      WHERE o.created_at::date BETWEEN $1 AND $2
      ORDER BY o.created_at DESC`,
    [from, to]
  );
  res.json(
    rows.map((r) => ({
      reference: r.reference,
      email: r.email,
      courseTitle: r.course_title,
      amount: r.amount,
      method: r.method,
      status: r.status,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    }))
  );
});

/** GET /admin/reports/certificates — เกียรติบัตรที่ออกไปแล้วทั้งหมด */
reportRouter.get("/certificates", async (_req, res) => {
  const rows = await q(
    `SELECT ct.code, ct.issued_at, ct.quiz_percent,
            u.email, coalesce(u.display_name, '') AS name, c.title AS course_title
       FROM certificates ct
       JOIN users u ON u.id = ct.user_id
       JOIN courses c ON c.id = ct.course_id
      ORDER BY ct.issued_at DESC`
  );
  res.json(
    rows.map((r) => ({
      code: r.code,
      email: r.email,
      name: r.name,
      courseTitle: r.course_title,
      issuedAt: r.issued_at,
      quizPercent: r.quiz_percent,
    }))
  );
});
