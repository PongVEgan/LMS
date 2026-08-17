/**
 * ล้างและสร้างฐานข้อมูลใหม่พร้อมข้อมูลตัวอย่าง
 *   npm --prefix server run db:reset
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, q, q1 } from "./pool.js";
import { hashPassword } from "../lib/password.js";

const here = dirname(fileURLToPath(import.meta.url));

const PASSWORD = "password123";

async function main() {
  const schema = await readFile(join(here, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("✓ สร้างตารางแล้ว");

  const hash = await hashPassword(PASSWORD);

  const student = await q1<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, phone, business_name, industry, province)
     VALUES ('student@example.com', $1, 'นักเรียนทดสอบ', '0800000000', 'ร้านกาแฟตัวอย่าง', 'อาหารและเครื่องดื่ม', 'กรุงเทพมหานคร')
     RETURNING id`,
    [hash]
  );
  const admin = await q1<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role, business_name)
     VALUES ('admin@example.com', $1, 'แอดมิน', 'admin', 'ทีมงาน')
     RETURNING id`,
    [hash]
  );
  const other = await q1<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, business_name, province)
     VALUES ('member@example.com', $1, 'สมาชิกอีกคน', 'โรงงานตัวอย่าง', 'เชียงใหม่')
     RETURNING id`,
    [hash]
  );
  console.log("✓ สร้างผู้ใช้ 3 คน");

  // --- คอร์สที่นักเรียนมีสิทธิ์เรียน ---
  const course = await q1<{ id: string }>(
    `INSERT INTO courses (slug, title, description, price)
     VALUES ('starter-course', 'คอร์สเริ่มต้น', 'คอร์สตัวอย่างสำหรับทดสอบระบบ', 2900)
     RETURNING id`
  );
  // --- คอร์สที่ยังไม่ได้ซื้อ (โชว์ในแคตตาล็อก) ---
  await q(
    `INSERT INTO courses (slug, title, description, price)
     VALUES ('advanced-course', 'คอร์สขั้นสูง', 'คอร์สที่ยังไม่ได้ซื้อ ใช้ทดสอบหน้าล็อก', 4900)`
  );

  await q(
    `INSERT INTO enrollments (user_id, course_id, customer_code) VALUES ($1, $2, 'DEV-0001')`,
    [student!.id, course!.id]
  );
  await q(
    `INSERT INTO enrollments (user_id, course_id, customer_code) VALUES ($1, $2, 'DEV-0002')`,
    [admin!.id, course!.id]
  );

  const chapter1 = await q1<{ id: string }>(
    `INSERT INTO chapters (course_id, title, sort_order) VALUES ($1, 'บทที่ 1 · เริ่มต้น', 1) RETURNING id`,
    [course!.id]
  );
  const chapter2 = await q1<{ id: string }>(
    `INSERT INTO chapters (course_id, title, sort_order) VALUES ($1, 'บทที่ 2 · ลงมือทำ', 2) RETURNING id`,
    [course!.id]
  );

  const lesson1 = await q1<{ id: string }>(
    `INSERT INTO lessons (chapter_id, title, description, type, video_url, duration, sort_order, is_free)
     VALUES ($1, 'แนะนำคอร์ส', 'ภาพรวมว่าจะได้อะไรจากคอร์สนี้', 'video',
             'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 635, 1, true)
     RETURNING id`,
    [chapter1!.id]
  );
  await q(
    `INSERT INTO lessons (chapter_id, title, description, type, video_url, duration, sort_order)
     VALUES ($1, 'ตั้งค่าเครื่องมือ', 'ลงโปรแกรมที่ต้องใช้', 'video',
             'https://youtu.be/jNQXAC9IVRw?t=5', 19, 2)`,
    [chapter1!.id]
  );
  await q(
    `INSERT INTO lessons (chapter_id, title, type, content, duration, sort_order)
     VALUES ($1, 'สรุปเป็นบทความ', 'text',
             'บทเรียนแบบข้อความ ใช้ทดสอบว่า type = text แสดงผลถูกต้อง' || chr(10) || chr(10) ||
             'ขึ้นบรรทัดใหม่ได้ตามปกติ', 180, 1)`,
    [chapter2!.id]
  );
  await q(
    `INSERT INTO lessons (chapter_id, title, type, duration, sort_order)
     VALUES ($1, 'ไฟล์ประกอบ', 'file', 60, 2)`,
    [chapter2!.id]
  );

  await q(
    `INSERT INTO attachments (lesson_id, url, name, size)
     VALUES ($1, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'เอกสารประกอบ.pdf', 13264)`,
    [lesson1!.id]
  );

  // เรียนจบไปแล้ว 1 บท เพื่อให้เห็น progress ไม่เป็น 0
  await q(
    `INSERT INTO progress (user_id, lesson_id, completed, completed_at) VALUES ($1, $2, true, now())`,
    [student!.id, lesson1!.id]
  );
  console.log("✓ สร้างคอร์ส 2 คอร์ส + บทเรียน 4 บท");

  // --- คำสั่งซื้อตัวอย่าง ---
  const advanced = await q1<{ id: string; price: number }>(
    "SELECT id, price FROM courses WHERE slug = 'advanced-course'"
  );
  await q(
    `INSERT INTO orders (user_id, course_id, amount, method, status, reference, paid_at)
     VALUES ($1, $2, 2900, 'card', 'paid', 'ORD-SEED0001', now() - interval '3 days')`,
    [student!.id, course!.id]
  );
  await q(
    `INSERT INTO orders (user_id, course_id, amount, method, status, reference, note)
     VALUES ($1, $2, $3, 'transfer', 'awaiting_review', 'ORD-SEED0002', 'โอนแล้วเมื่อเช้าครับ')`,
    [other!.id, advanced!.id, advanced!.price]
  );
  console.log("✓ สร้างคำสั่งซื้อตัวอย่าง 2 รายการ (จ่ายแล้ว 1 · รออนุมัติ 1)");

  // --- community ---
  const post = await q1<{ id: string }>(
    `INSERT INTO posts (author_id, content, category, is_pinned, is_announcement)
     VALUES ($1, 'ยินดีต้อนรับเข้าสู่คอมมูนิตี้ 🎉 แนะนำตัวกันได้เลย', 'general', true, true)
     RETURNING id`,
    [admin!.id]
  );
  await q(
    `INSERT INTO posts (author_id, content, category)
     VALUES ($1, 'สวัสดีครับ ผมเปิดร้านกาแฟเล็กๆ อยู่ ยินดีที่ได้รู้จักครับ', 'introduction')`,
    [student!.id]
  );
  await q(
    `INSERT INTO posts (author_id, content, category)
     VALUES ($1, 'มีใครใช้ระบบจัดการสต็อกตัวไหนอยู่บ้างครับ แนะนำหน่อย', 'general')`,
    [other!.id]
  );
  await q(`INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, 'ยินดีที่ได้รู้จักครับ')`, [
    post!.id,
    student!.id,
  ]);
  await q(`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2), ($1, $3)`, [
    post!.id,
    student!.id,
    other!.id,
  ]);
  console.log("✓ สร้างโพสต์ตัวอย่าง 3 โพสต์");

  console.log(`
เสร็จแล้ว — เข้าสู่ระบบด้วย:
  student@example.com / ${PASSWORD}   (มีคอร์ส 1 คอร์ส)
  admin@example.com   / ${PASSWORD}   (role = admin)
  member@example.com  / ${PASSWORD}   (ยังไม่มีคอร์ส)
`);

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
