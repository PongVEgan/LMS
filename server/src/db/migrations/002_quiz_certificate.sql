-- 2026-08-18 — แบบทดสอบ + เกียรติบัตร
-- รันซ้ำได้ ไม่ลบข้อมูลเดิม:
--   docker exec -i lms-postgres psql -U lms -d lms < server/src/db/migrations/002_quiz_certificate.sql

-- lesson type เพิ่ม 'quiz'
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
  CHECK (type IN ('video', 'text', 'file', 'quiz'));

-- แบบทดสอบ 1 ชุดต่อ 1 บทเรียน
CREATE TABLE IF NOT EXISTS quizzes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'แบบทดสอบ',
  description  text,
  pass_percent integer NOT NULL DEFAULT 70,   -- เกณฑ์ผ่าน (%)
  time_limit   integer NOT NULL DEFAULT 0,    -- นาที · 0 = ไม่จำกัดเวลา
  max_attempts integer NOT NULL DEFAULT 0,    -- 0 = ทำซ้ำได้ไม่จำกัด
  shuffle      boolean NOT NULL DEFAULT true, -- สลับลำดับข้อ
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text        text NOT NULL,
  -- single = เลือกคำตอบเดียว · multiple = เลือกได้หลายข้อ (ต้องตรงทั้งชุดถึงได้คะแนน)
  type        text NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'multiple')),
  explanation text,                            -- เฉลยอธิบาย โชว์หลังส่งคำตอบ
  score       integer NOT NULL DEFAULT 1,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS choices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score        integer NOT NULL DEFAULT 0,
  max_score    integer NOT NULL DEFAULT 0,
  percent      integer NOT NULL DEFAULT 0,
  passed       boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id  uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_ids  uuid[] NOT NULL DEFAULT '{}',
  correct     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (attempt_id, question_id)
);

-- เกียรติบัตร — ออกให้เมื่อเรียนครบทุกบทและสอบผ่านทุกชุดในคอร์ส
CREATE TABLE IF NOT EXISTS certificates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code       text UNIQUE NOT NULL,             -- เลขที่ไว้ให้คนอื่นตรวจสอบ
  issued_at  timestamptz NOT NULL DEFAULT now(),
  quiz_percent integer,                        -- คะแนนสอบเฉลี่ย (NULL = คอร์สไม่มีข้อสอบ)
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS questions_quiz_idx ON questions (quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS choices_question_idx ON choices (question_id, sort_order);
CREATE INDEX IF NOT EXISTS attempts_user_idx ON quiz_attempts (user_id, quiz_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON certificates (user_id, issued_at DESC);
