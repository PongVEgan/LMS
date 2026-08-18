import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { requireUser } from "../lib/user.js";
import { checkCourseCompletion, courseIdOfLesson } from "../lib/completion.js";

/** แบบทดสอบฝั่งผู้เรียน — ไม่ส่งเฉลยออกไปก่อนส่งคำตอบเด็ดขาด */
export const quizRouter = Router();
quizRouter.use(requireUser);

/** ผู้เรียนต้องมีสิทธิ์เรียนคอร์สที่แบบทดสอบนั้นอยู่ */
async function assertAccess(userId: string, lessonId: string) {
  const courseId = await courseIdOfLesson(lessonId);
  if (!courseId) return null;
  const ok = await q1(
    "SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [userId, courseId]
  );
  return ok ? courseId : null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** GET /learn/quizzes/:lessonId — โจทย์ + ประวัติการทำ (ไม่มีเฉลย) */
quizRouter.get("/quizzes/:lessonId", async (req, res) => {
  const courseId = await assertAccess(req.user!.id, req.params.lessonId);
  if (!courseId) return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้" });

  const quiz = await q1("SELECT * FROM quizzes WHERE lesson_id = $1", [req.params.lessonId]);
  if (!quiz) return res.status(404).json({ message: "บทเรียนนี้ยังไม่มีแบบทดสอบ" });

  const rows = await q(
    `SELECT qs.id, qs.text, qs.type, qs.score, qs.sort_order,
            c.id AS choice_id, c.text AS choice_text, c.sort_order AS choice_order
       FROM questions qs
       LEFT JOIN choices c ON c.question_id = qs.id
      WHERE qs.quiz_id = $1
      ORDER BY qs.sort_order, c.sort_order`,
    [quiz.id]
  );

  const questions: any[] = [];
  for (const r of rows) {
    let question = questions.find((x) => x.id === r.id);
    if (!question) {
      question = { id: r.id, text: r.text, type: r.type, score: r.score, choices: [] };
      questions.push(question);
    }
    if (r.choice_id) question.choices.push({ id: r.choice_id, text: r.choice_text });
  }

  const attempts = await q(
    `SELECT id, submitted_at, score, max_score, percent, passed
       FROM quiz_attempts
      WHERE quiz_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL
      ORDER BY submitted_at DESC`,
    [quiz.id, req.user!.id]
  );

  const best = attempts.reduce((m, a) => Math.max(m, a.percent), 0);
  const canAttempt = quiz.max_attempts === 0 || attempts.length < quiz.max_attempts;

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    passPercent: quiz.pass_percent,
    timeLimit: quiz.time_limit,
    maxAttempts: quiz.max_attempts,
    questionCount: questions.length,
    totalScore: questions.reduce((sum, x) => sum + x.score, 0),
    questions: quiz.shuffle ? shuffle(questions) : questions,
    attempts: attempts.map((a) => ({
      id: a.id,
      submittedAt: a.submitted_at,
      score: a.score,
      maxScore: a.max_score,
      percent: a.percent,
      passed: a.passed,
    })),
    bestPercent: best,
    passed: attempts.some((a) => a.passed),
    canAttempt,
  });
});

/** POST /learn/quizzes/:lessonId/attempts — เริ่มทำข้อสอบ (บันทึกเวลาเริ่ม) */
quizRouter.post("/quizzes/:lessonId/attempts", async (req, res) => {
  const courseId = await assertAccess(req.user!.id, req.params.lessonId);
  if (!courseId) return res.status(403).json({ message: "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้" });

  const quiz = await q1("SELECT * FROM quizzes WHERE lesson_id = $1", [req.params.lessonId]);
  if (!quiz) return res.status(404).json({ message: "บทเรียนนี้ยังไม่มีแบบทดสอบ" });

  if (quiz.max_attempts > 0) {
    const done = await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL",
      [quiz.id, req.user!.id]
    );
    if (done!.n >= quiz.max_attempts) {
      return res.status(409).json({ message: `ทำข้อสอบครบ ${quiz.max_attempts} ครั้งแล้ว` });
    }
  }

  const row = await q1(
    "INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING id, started_at",
    [quiz.id, req.user!.id]
  );
  res.status(201).json({ attemptId: row!.id, startedAt: row!.started_at, timeLimit: quiz.time_limit });
});

/**
 * POST /learn/attempts/:id/submit — { answers: [{ questionId, choiceIds }] }
 * ตรวจให้ทันที คืนผลรายข้อพร้อมเฉลย และถ้าผ่านก็ติ๊กบทเรียนว่าจบให้เลย
 */
quizRouter.post("/attempts/:id/submit", async (req, res) => {
  const attempt = await q1(
    `SELECT a.*, z.pass_percent, z.lesson_id, z.time_limit, z.max_attempts
       FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
      WHERE a.id = $1 AND a.user_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (!attempt) return res.status(404).json({ message: "ไม่พบการทำข้อสอบครั้งนี้" });
  if (attempt.submitted_at) return res.status(409).json({ message: "ส่งคำตอบไปแล้ว" });

  // เช็คโควตาอีกรอบตอนส่ง — ตอนสร้าง attempt เช็คแล้วก็จริง แต่เปิดหลายแท็บพร้อมกัน
  // จะสร้างได้หลาย attempt ก่อนที่อันไหนจะถูกส่ง ทำให้ทำเกินจำนวนครั้งที่กำหนดได้
  if (attempt.max_attempts > 0) {
    const done = await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL",
      [attempt.quiz_id, req.user!.id]
    );
    if (done!.n >= attempt.max_attempts) {
      await q("DELETE FROM quiz_attempts WHERE id = $1", [attempt.id]);
      return res.status(409).json({ message: `ทำข้อสอบครบ ${attempt.max_attempts} ครั้งแล้ว` });
    }
  }

  // หมดเวลาแล้วส่งไม่ได้ (ตัวนับถอยหลังอยู่ฝั่ง browser ปลอมได้ ต้องกันที่เซิร์ฟเวอร์ด้วย)
  // เผื่อเวลาให้ 60 วินาทีกันเน็ตหน่วงตอนกดส่งพอดี
  if (attempt.time_limit > 0) {
    const elapsed = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
    if (elapsed > attempt.time_limit * 60 + 60) {
      await q(
        "UPDATE quiz_attempts SET submitted_at = now(), score = 0, max_score = 0, percent = 0, passed = false WHERE id = $1",
        [attempt.id]
      );
      return res.status(409).json({ message: "หมดเวลาทำข้อสอบแล้ว" });
    }
  }

  const answers: { questionId: string; choiceIds: string[] }[] = Array.isArray(req.body?.answers)
    ? req.body.answers
    : [];

  // โจทย์พร้อมเฉลย (ฝั่งเซิร์ฟเวอร์เท่านั้น)
  const rows = await q(
    `SELECT qs.id, qs.text, qs.type, qs.score, qs.explanation,
            c.id AS choice_id, c.text AS choice_text, c.is_correct
       FROM questions qs
       LEFT JOIN choices c ON c.question_id = qs.id
      WHERE qs.quiz_id = $1
      ORDER BY qs.sort_order, c.sort_order`,
    [attempt.quiz_id]
  );

  const questions: any[] = [];
  for (const r of rows) {
    let question = questions.find((x) => x.id === r.id);
    if (!question) {
      question = { id: r.id, text: r.text, type: r.type, score: r.score, explanation: r.explanation, choices: [] };
      questions.push(question);
    }
    if (r.choice_id) {
      question.choices.push({ id: r.choice_id, text: r.choice_text, isCorrect: r.is_correct });
    }
  }

  let score = 0;
  let maxScore = 0;
  const results = [];

  // ตัวเลือกที่ส่งมาต้องเป็น uuid จริง ไม่งั้น Postgres จะพังตอน insert เข้า uuid[]
  const isUuid = (v: unknown) =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  for (const question of questions) {
    maxScore += question.score;
    const ownChoiceIds: string[] = question.choices.map((c: any) => c.id);

    // ต้อง de-dup และตัดตัวเลือกที่ไม่ใช่ของข้อนี้ทิ้ง
    // ไม่งั้นส่ง ["c1","c1"] มาแทน ["c1","c2"] จะนับว่าตอบถูกทั้งที่รู้คำตอบแค่ข้อเดียว
    const picked = [
      ...new Set(
        (answers.find((a) => a.questionId === question.id)?.choiceIds ?? [])
          .filter(isUuid)
          .filter((id: string) => ownChoiceIds.includes(id))
      ),
    ];
    const correctIds = question.choices.filter((c: any) => c.isCorrect).map((c: any) => c.id);

    // ข้อที่ไม่ได้ตั้งคำตอบถูกไว้ = ข้อเสีย ไม่ให้คะแนนใคร (เดิม [] === [] จะกลายเป็นตอบถูกทุกคน)
    const isCorrect =
      correctIds.length > 0 &&
      picked.length === correctIds.length &&
      picked.every((id: string) => correctIds.includes(id));
    if (isCorrect) score += question.score;

    await q(
      `INSERT INTO attempt_answers (attempt_id, question_id, choice_ids, correct)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (attempt_id, question_id) DO UPDATE SET choice_ids = EXCLUDED.choice_ids, correct = EXCLUDED.correct`,
      [attempt.id, question.id, picked, isCorrect]
    );

    results.push({
      questionId: question.id,
      text: question.text,
      correct: isCorrect,
      pickedIds: picked,
      correctIds,
      explanation: question.explanation,
      score: isCorrect ? question.score : 0,
      maxScore: question.score,
    });
  }

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percent >= attempt.pass_percent;

  await q(
    `UPDATE quiz_attempts
        SET submitted_at = now(), score = $1, max_score = $2, percent = $3, passed = $4
      WHERE id = $5`,
    [score, maxScore, percent, passed, attempt.id]
  );

  // สอบผ่าน = ถือว่าเรียนบทนี้จบ
  if (passed) {
    await q(
      `INSERT INTO progress (user_id, lesson_id, completed, completed_at, watched_percent, last_seen_at)
       VALUES ($1, $2, true, now(), 100, now())
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET completed = true, completed_at = COALESCE(progress.completed_at, now()), last_seen_at = now()`,
      [req.user!.id, attempt.lesson_id]
    );
  }

  const courseId = await courseIdOfLesson(attempt.lesson_id);
  const completion = courseId ? await checkCourseCompletion(req.user!.id, courseId) : null;

  res.json({
    score,
    maxScore,
    percent,
    passed,
    passPercent: attempt.pass_percent,
    results,
    certificateCode: completion?.certificateCode ?? null,
  });
});
