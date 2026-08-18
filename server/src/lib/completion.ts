import { randomBytes } from "node:crypto";
import { q, q1 } from "../db/pool.js";

/**
 * ตรวจว่าผู้เรียนจบคอร์สครบเงื่อนไขหรือยัง แล้วออกเกียรติบัตรให้อัตโนมัติ
 * เงื่อนไข: เรียนครบทุกบทเรียน + สอบผ่านทุกแบบทดสอบในคอร์ส
 * เรียกทุกครั้งที่ความคืบหน้าเปลี่ยน (ทำบทเรียนจบ / ส่งข้อสอบ)
 */
export interface CourseCompletion {
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  quizPercent: number | null;
  eligible: boolean;
  certificateCode: string | null;
}

// 8 ไบต์ = 64 บิต โอกาสชนต่ำมาก และยังมี retry เผื่อไว้อีกชั้น
const newCode = () => `CERT-${randomBytes(8).toString("hex").toUpperCase()}`;

export async function checkCourseCompletion(userId: string, courseId: string): Promise<CourseCompletion> {
  const lessons = await q1<{ total: number; done: number }>(
    `SELECT count(l.id)::int AS total,
            count(p.lesson_id) FILTER (WHERE p.completed)::int AS done
       FROM chapters ch
       JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = $2
      WHERE ch.course_id = $1`,
    [courseId, userId]
  );

  // แบบทดสอบทุกชุดในคอร์ส + ผลสอบครั้งที่ดีที่สุดของผู้เรียนคนนี้
  // ข้ามชุดที่ยังไม่มีคำถาม — ไม่งั้นแอดมินกดสร้างชุดเปล่าทิ้งไว้
  // จะทำให้ทุกคนในคอร์สไม่มีวันได้เกียรติบัตร (สอบชุดเปล่ายังไงก็ได้ 0%)
  const quizzes = await q<{ quiz_id: string; best: number | null; passed: boolean | null }>(
    `SELECT z.id AS quiz_id,
            max(a.percent) AS best,
            bool_or(a.passed) AS passed
       FROM quizzes z
       JOIN lessons l ON l.id = z.lesson_id
       JOIN chapters ch ON ch.id = l.chapter_id
       LEFT JOIN quiz_attempts a ON a.quiz_id = z.id AND a.user_id = $2 AND a.submitted_at IS NOT NULL
      WHERE ch.course_id = $1
        AND EXISTS (SELECT 1 FROM questions WHERE quiz_id = z.id)
      GROUP BY z.id`,
    [courseId, userId]
  );

  const totalQuizzes = quizzes.length;
  const passedQuizzes = quizzes.filter((z) => z.passed).length;
  const scored = quizzes.filter((z) => z.best !== null).map((z) => Number(z.best));
  const quizPercent = scored.length
    ? Math.round(scored.reduce((sum, n) => sum + n, 0) / scored.length)
    : null;

  const totalLessons = lessons?.total ?? 0;
  const completedLessons = lessons?.done ?? 0;
  const eligible =
    totalLessons > 0 && completedLessons >= totalLessons && passedQuizzes >= totalQuizzes;

  let certificateCode: string | null = null;
  if (eligible) {
    const existing = await q1<{ code: string }>(
      "SELECT code FROM certificates WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );
    if (existing) {
      certificateCode = existing.code;
    } else {
      // ถ้าเลขชนกัน (unique violation) ให้สุ่มใหม่ ไม่ปล่อยให้ error หลุดไปทำลาย
      // response ของการส่งข้อสอบที่ตรวจเสร็จแล้ว
      for (let attempt = 0; attempt < 3 && !certificateCode; attempt++) {
        try {
          const row = await q1<{ code: string }>(
            `INSERT INTO certificates (user_id, course_id, code, quiz_percent)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, course_id) DO UPDATE SET code = certificates.code
             RETURNING code`,
            [userId, courseId, newCode(), quizPercent]
          );
          certificateCode = row?.code ?? null;
        } catch (err) {
          if ((err as { code?: string }).code !== "23505") throw err;
        }
      }
    }
  }

  return {
    totalLessons,
    completedLessons,
    totalQuizzes,
    passedQuizzes,
    quizPercent,
    eligible,
    certificateCode,
  };
}

/** หา courseId จาก lessonId (ใช้บ่อยเวลาความคืบหน้าเปลี่ยน) */
export async function courseIdOfLesson(lessonId: string): Promise<string | null> {
  const row = await q1<{ course_id: string }>(
    "SELECT ch.course_id FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id WHERE l.id = $1",
    [lessonId]
  );
  return row?.course_id ?? null;
}
