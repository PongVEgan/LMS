import { Router } from "express";
import { randomBytes } from "node:crypto";
import { q, q1 } from "../db/pool.js";
import { requireUser } from "../lib/user.js";

export const checkoutRouter = Router();
checkoutRouter.use(requireUser);

/**
 * ระบบชำระเงิน "จำลอง" — ไม่มีการตัดเงินจริง ไม่ต่อ payment gateway ใดๆ
 * ผลลัพธ์ตัดสินจากเลขบัตรที่กรอก เพื่อให้ทดสอบทั้งเคสสำเร็จและเคสล้มเหลวได้
 *
 *   4242 4242 4242 4242  → จ่ายสำเร็จ
 *   4000 0000 0000 0002  → ถูกปฏิเสธ (บัตรถูก decline)
 *   4000 0000 0000 0069  → บัตรหมดอายุ
 *   เลขอื่นที่ 16 หลัก     → จ่ายสำเร็จ
 */
const TEST_CARDS: Record<string, { ok: boolean; message: string }> = {
  "4000000000000002": { ok: false, message: "บัตรถูกปฏิเสธจากธนาคารผู้ออกบัตร" },
  "4000000000000069": { ok: false, message: "บัตรหมดอายุ" },
  "4000000000000127": { ok: false, message: "รหัส CVC ไม่ถูกต้อง" },
};

const ref = () => `ORD-${randomBytes(4).toString("hex").toUpperCase()}`;

function toOrder(r: any) {
  return {
    id: r.id,
    courseId: r.course_id,
    courseTitle: r.course_title,
    courseSlug: r.course_slug,
    amount: r.amount,
    method: r.method,
    status: r.status,
    reference: r.reference,
    note: r.note,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  };
}

const ORDER_SELECT = `
  SELECT o.*, c.title AS course_title, c.slug AS course_slug
    FROM orders o JOIN courses c ON c.id = o.course_id
`;

/** ให้สิทธิ์เรียน + ปิดออร์เดอร์เป็น paid */
async function grantAccess(orderId: string, userId: string, courseId: string, reference: string) {
  await q(
    `INSERT INTO enrollments (user_id, course_id, customer_code)
     VALUES ($1, $2, $3) ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId, courseId, reference]
  );
  await q("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1", [orderId]);
}

/** GET /checkout/courses/:slug — ข้อมูลคอร์สสำหรับหน้าชำระเงิน */
checkoutRouter.get("/courses/:slug", async (req, res) => {
  const course = await q1(
    "SELECT id, slug, title, description, cover_url, price FROM courses WHERE slug = $1 AND published = true",
    [req.params.slug]
  );
  if (!course) return res.status(404).json({ message: "ไม่พบคอร์สนี้" });

  const owned = await q1("SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2", [
    req.user!.id,
    course.id,
  ]);

  res.json({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    coverUrl: course.cover_url,
    price: course.price,
    owned: !!owned,
  });
});

/** POST /checkout/orders — { courseSlug, method } สร้างคำสั่งซื้อ */
checkoutRouter.post("/orders", async (req, res) => {
  const method = String(req.body?.method ?? "card");
  if (!["card", "qr", "transfer"].includes(method)) {
    return res.status(400).json({ message: "ช่องทางชำระเงินไม่ถูกต้อง" });
  }

  const course = await q1("SELECT id, price FROM courses WHERE slug = $1 AND published = true", [
    String(req.body?.courseSlug ?? ""),
  ]);
  if (!course) return res.status(404).json({ message: "ไม่พบคอร์สนี้" });

  const owned = await q1("SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2", [
    req.user!.id,
    course.id,
  ]);
  if (owned) return res.status(409).json({ message: "คุณมีสิทธิ์เรียนคอร์สนี้อยู่แล้ว" });

  const row = await q1(
    `INSERT INTO orders (user_id, course_id, amount, method, reference)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [req.user!.id, course.id, course.price, method, ref()]
  );

  const order = await q1(`${ORDER_SELECT} WHERE o.id = $1`, [row!.id]);
  res.status(201).json(toOrder(order));
});

/** GET /checkout/orders — ประวัติการสั่งซื้อของตัวเอง */
checkoutRouter.get("/orders", async (req, res) => {
  const rows = await q(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user!.id]);
  res.json(rows.map(toOrder));
});

/** GET /checkout/orders/:id */
checkoutRouter.get("/orders/:id", async (req, res) => {
  const order = await q1(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [
    req.params.id,
    req.user!.id,
  ]);
  if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อนี้" });
  res.json(toOrder(order));
});

/**
 * POST /checkout/orders/:id/pay — จำลองการจ่ายเงิน
 *   card     → { cardNumber } ตัดสินผลจากเลขบัตรทดสอบ
 *   qr       → กด "ชำระแล้ว" = สำเร็จทันที
 *   transfer → แจ้งโอน แล้วรอแอดมินอนุมัติ (awaiting_review)
 */
checkoutRouter.post("/orders/:id/pay", async (req, res) => {
  const order = await q1(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [
    req.params.id,
    req.user!.id,
  ]);
  if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อนี้" });
  if (order.status === "paid") return res.status(409).json({ message: "คำสั่งซื้อนี้ชำระเงินแล้ว" });

  if (order.method === "transfer") {
    await q("UPDATE orders SET status = 'awaiting_review', note = $1 WHERE id = $2", [
      req.body?.note ? String(req.body.note) : null,
      order.id,
    ]);
    const updated = await q1(`${ORDER_SELECT} WHERE o.id = $1`, [order.id]);
    return res.json(toOrder(updated));
  }

  if (order.method === "card") {
    const number = String(req.body?.cardNumber ?? "").replace(/\D/g, "");
    if (number.length !== 16) return res.status(400).json({ message: "เลขบัตรต้องมี 16 หลัก" });

    const failure = TEST_CARDS[number];
    if (failure && !failure.ok) {
      await q("UPDATE orders SET status = 'failed', note = $1 WHERE id = $2", [failure.message, order.id]);
      return res.status(402).json({ message: failure.message });
    }
  }

  await grantAccess(order.id, req.user!.id, order.course_id, order.reference);
  const updated = await q1(`${ORDER_SELECT} WHERE o.id = $1`, [order.id]);
  res.json(toOrder(updated));
});
