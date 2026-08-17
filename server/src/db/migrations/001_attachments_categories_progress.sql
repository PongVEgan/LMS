-- 2026-08-18 — ไฟล์แนบ / หมวดหมู่คอมมูนิตี้ / ติดตามการดูวิดีโอ
-- รันซ้ำได้ ไม่ลบข้อมูลเดิม:
--   docker exec -i lms-postgres psql -U lms -d lms < server/src/db/migrations/001_....sql

-- 1) หมวดหมู่โพสต์ — ย้ายออกจากที่ hardcode ไว้ในโค้ดหน้าเว็บ
CREATE TABLE IF NOT EXISTS post_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  label      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO post_categories (slug, label, sort_order) VALUES
  ('introduction', 'แนะนำตัว', 1),
  ('general',      'ทั่วไป',   2),
  ('question',     'ถาม-ตอบ',  3),
  ('showcase',     'อวดผลงาน', 4)
ON CONFLICT (slug) DO NOTHING;

-- 2) ติดตามการดูวิดีโอ — ของเดิมเก็บแค่ completed
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS position_seconds integer NOT NULL DEFAULT 0,  -- ดูค้างไว้ตรงไหน (resume)
  ADD COLUMN IF NOT EXISTS watched_percent  integer NOT NULL DEFAULT 0,  -- % สูงสุดที่เคยดูถึง
  ADD COLUMN IF NOT EXISTS watched_seconds  integer NOT NULL DEFAULT 0,  -- เวลาที่ดูสะสมจริง
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;

-- 3) ไฟล์แนบ — ตารางมีอยู่แล้ว เพิ่มแค่ลำดับและวันที่
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
