import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { requireUser } from "../lib/user.js";
import { checkCourseCompletion } from "../lib/completion.js";

/** เกียรติบัตรของผู้เรียน (ต้องล็อกอิน) */
export const certificateRouter = Router();
certificateRouter.use(requireUser);

/** GET /learn/certificates — เกียรติบัตรทั้งหมดของตัวเอง */
certificateRouter.get("/certificates", async (req, res) => {
  const rows = await q(
    `SELECT ct.code, ct.issued_at, ct.quiz_percent, c.title, c.slug
       FROM certificates ct JOIN courses c ON c.id = ct.course_id
      WHERE ct.user_id = $1 ORDER BY ct.issued_at DESC`,
    [req.user!.id]
  );
  res.json(
    rows.map((r) => ({
      code: r.code,
      issuedAt: r.issued_at,
      quizPercent: r.quiz_percent,
      courseTitle: r.title,
      courseSlug: r.slug,
    }))
  );
});

/**
 * GET /learn/courses/:slug/completion
 * ความคืบหน้าสู่เกียรติบัตร — ถ้าครบเงื่อนไขแล้วจะออกให้ทันทีตรงนี้
 */
certificateRouter.get("/courses/:slug/completion", async (req, res) => {
  const course = await q1<{ id: string; title: string }>(
    "SELECT id, title FROM courses WHERE slug = $1",
    [req.params.slug]
  );
  if (!course) return res.status(404).json({ message: "ไม่พบคอร์สนี้" });

  const enrolled = await q1(
    "SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [req.user!.id, course.id]
  );
  if (!enrolled) return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้" });

  const completion = await checkCourseCompletion(req.user!.id, course.id);
  res.json({ courseTitle: course.title, ...completion });
});
