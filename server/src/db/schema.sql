-- โครงฐานข้อมูล LMS (dev) — รันซ้ำได้ ไฟล์นี้ลบของเดิมทิ้งก่อนเสมอ
DROP TABLE IF EXISTS comment_likes, post_likes, comments, posts, post_categories,
  attempt_answers, quiz_attempts, choices, questions, quizzes, certificates,
  password_resets, progress, attachments, lessons, chapters,
  orders, enrollments, courses, users CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,                        -- NULL = ยังไม่ได้ตั้งรหัสผ่าน
  display_name  text,
  phone         text,
  line_id       text,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  -- โปรไฟล์ฝั่ง community
  bio           text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  industry      text NOT NULL DEFAULT '',
  province      text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  description text,
  cover_url   text,
  price       integer NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enrollments (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  customer_code text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'active',
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE chapters (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id  uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'text', 'file', 'quiz')),
  content     text,                          -- ใช้เมื่อ type = 'text'
  video_url   text,                          -- ลิงก์ YouTube เท่านั้น
  duration    integer NOT NULL DEFAULT 0,    -- วินาที
  sort_order  integer NOT NULL DEFAULT 0,
  is_free     boolean NOT NULL DEFAULT false
);

CREATE TABLE attachments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  url        text NOT NULL,
  name       text NOT NULL,
  size       integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE progress (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  -- ติดตามการดูวิดีโอ (YouTube IFrame API เป็นคนส่งค่ามา)
  position_seconds integer NOT NULL DEFAULT 0,   -- ดูค้างไว้ตรงไหน ใช้เล่นต่อ
  watched_percent  integer NOT NULL DEFAULT 0,   -- % สูงสุดที่เคยดูถึง
  watched_seconds  integer NOT NULL DEFAULT 0,   -- เวลาที่ดูสะสมจริง
  last_seen_at     timestamptz,
  PRIMARY KEY (user_id, lesson_id)
);

-- คำสั่งซื้อ (ระบบชำระเงินจำลอง — ไม่มีการตัดเงินจริง)
CREATE TABLE orders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount     integer NOT NULL,
  method     text NOT NULL DEFAULT 'card' CHECK (method IN ('card', 'qr', 'transfer')),
  -- pending = เพิ่งสร้าง · awaiting_review = แจ้งโอนแล้วรอแอดมินอนุมัติ
  -- paid = จ่ายสำเร็จ (ได้สิทธิ์เรียนแล้ว) · failed = ถูกปฏิเสธ
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'awaiting_review', 'paid', 'failed')),
  reference  text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at    timestamptz
);

CREATE TABLE password_resets (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false
);

-- หมวดหมู่โพสต์คอมมูนิตี้ (จัดการผ่านหน้าแอดมิน)
CREATE TABLE post_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  label      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  image_url       text,
  category        text NOT NULL DEFAULT 'general',
  is_pinned       boolean NOT NULL DEFAULT false,
  is_announcement boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE post_likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comment_likes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

-- ===== แบบทดสอบ =====
CREATE TABLE quizzes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'แบบทดสอบ',
  description  text,
  pass_percent integer NOT NULL DEFAULT 70,   -- เกณฑ์ผ่าน (%)
  time_limit   integer NOT NULL DEFAULT 0,    -- นาที · 0 = ไม่จำกัดเวลา
  max_attempts integer NOT NULL DEFAULT 0,    -- 0 = ทำซ้ำได้ไม่จำกัด
  shuffle      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text        text NOT NULL,
  type        text NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'multiple')),
  explanation text,
  score       integer NOT NULL DEFAULT 1,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE choices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE quiz_attempts (
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

CREATE TABLE attempt_answers (
  attempt_id  uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_ids  uuid[] NOT NULL DEFAULT '{}',
  correct     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (attempt_id, question_id)
);

-- ===== เกียรติบัตร =====
CREATE TABLE certificates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code         text UNIQUE NOT NULL,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  quiz_percent integer,
  UNIQUE (user_id, course_id)
);

CREATE INDEX ON questions (quiz_id, sort_order);
CREATE INDEX ON choices (question_id, sort_order);
CREATE INDEX ON quiz_attempts (user_id, quiz_id, submitted_at DESC);
CREATE INDEX ON certificates (user_id, issued_at DESC);
CREATE INDEX ON orders (user_id, created_at DESC);
CREATE INDEX ON chapters (course_id, sort_order);
CREATE INDEX ON lessons (chapter_id, sort_order);
CREATE INDEX ON posts (created_at DESC);
CREATE INDEX ON comments (post_id, created_at);
