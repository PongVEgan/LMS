import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { requireAdmin, requireUser } from "../lib/user.js";

export const adminRouter = Router();
adminRouter.use(requireUser, requireAdmin);

/**
 * แปลงเป็นจำนวนเต็มไม่ติดลบ — คอลัมน์พวก duration/price/order เป็น integer
 * ถ้าปล่อยทศนิยมหรือ NaN ผ่านไป Postgres จะโยน error ภาษาอังกฤษดิบๆ ใส่หน้าผู้ใช้
 */
function toInt(value: unknown, fallback: number | null = null): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

/* ------------------------------------------------------------------ dashboard */

/** GET /admin/stats — ตัวเลขรวม + กราฟสมัครใหม่ 30 วัน + คอร์สยอดนิยม */
adminRouter.get("/stats", async (_req, res) => {
  const totals = await q1(`
    SELECT (SELECT count(*) FROM users)::int                        AS users,
           (SELECT count(*) FROM enrollments)::int                  AS enrollments,
           (SELECT count(*) FROM courses)::int                      AS courses,
           (SELECT count(*) FROM lessons)::int                      AS lessons,
           (SELECT count(*) FROM posts)::int                        AS posts,
           (SELECT count(*) FROM progress WHERE completed)::int     AS completed_lessons
  `);

  const signups = await q(`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
           count(u.id)::int AS count
      FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') AS d(day)
      LEFT JOIN users u ON u.created_at::date = d.day
     GROUP BY d.day ORDER BY d.day
  `);

  const topCourses = await q(`
    SELECT c.id, c.title,
           count(DISTINCT e.user_id)::int AS students,
           coalesce(round(avg(sub.percent)), 0)::int AS avg_percent
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(l.id) = 0 THEN 0
                    ELSE 100.0 * count(p.lesson_id) FILTER (WHERE p.completed) / count(l.id) END AS percent
          FROM chapters ch
          LEFT JOIN lessons l ON l.chapter_id = ch.id
          LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
         WHERE ch.course_id = c.id
      ) sub ON true
     GROUP BY c.id, c.title
     ORDER BY students DESC, c.title
     LIMIT 5
  `);

  res.json({
    users: totals!.users,
    enrollments: totals!.enrollments,
    courses: totals!.courses,
    lessons: totals!.lessons,
    posts: totals!.posts,
    completedLessons: totals!.completed_lessons,
    signups,
    topCourses: topCourses.map((c) => ({
      id: c.id,
      title: c.title,
      students: c.students,
      avgPercent: c.avg_percent,
    })),
  });
});

/* -------------------------------------------------------------------- courses */

/** GET /admin/courses */
adminRouter.get("/courses", async (_req, res) => {
  const rows = await q(`
    SELECT c.id, c.slug, c.title, c.description, c.cover_url, c.price, c.published, c.created_at,
           (SELECT count(*) FROM chapters WHERE course_id = c.id)::int AS chapter_count,
           (SELECT count(*) FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
             WHERE ch.course_id = c.id)::int AS lesson_count,
           (SELECT count(*) FROM enrollments WHERE course_id = c.id)::int AS student_count
      FROM courses c ORDER BY c.created_at DESC
  `);
  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      price: r.price,
      published: r.published,
      createdAt: r.created_at,
      chapterCount: r.chapter_count,
      lessonCount: r.lesson_count,
      studentCount: r.student_count,
    }))
  );
});

/** POST /admin/courses — { slug, title, description, price, published } */
adminRouter.post("/courses", async (req, res) => {
  const slug = String(req.body?.slug ?? "").trim();
  const title = String(req.body?.title ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ message: "slug ใช้ได้เฉพาะ a-z, 0-9 และ - เท่านั้น" });
  }
  if (!title) return res.status(400).json({ message: "ต้องมีชื่อคอร์ส" });
  if (await q1("SELECT 1 FROM courses WHERE slug = $1", [slug])) {
    return res.status(409).json({ message: "slug นี้ถูกใช้แล้ว" });
  }

  const row = await q1(
    `INSERT INTO courses (slug, title, description, price, published)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [slug, title, req.body?.description ?? null, toInt(req.body?.price, 0), req.body?.published !== false]
  );
  res.status(201).json({ id: row!.id });
});

/** GET /admin/courses/:id — คอร์ส + บท + บทเรียน + นักเรียน */
adminRouter.get("/courses/:id", async (req, res) => {
  const course = await q1("SELECT * FROM courses WHERE id = $1", [req.params.id]);
  if (!course) return res.status(404).json({ message: "ไม่พบคอร์สนี้" });

  const rows = await q(
    `SELECT ch.id AS chapter_id, ch.title AS chapter_title, ch.sort_order AS chapter_order,
            l.id, l.title, l.description, l.type, l.content, l.video_url,
            l.duration, l.sort_order, l.is_free
       FROM chapters ch
       LEFT JOIN lessons l ON l.chapter_id = ch.id
      WHERE ch.course_id = $1
      ORDER BY ch.sort_order, l.sort_order`,
    [course.id]
  );

  // ไฟล์แนบของทุกบทเรียนในคอร์ส ดึงทีเดียวแล้วค่อยแจกเข้าแต่ละบทเรียน
  const files = await q(
    `SELECT a.id, a.lesson_id, a.url, a.name, a.size
       FROM attachments a
       JOIN lessons l ON l.id = a.lesson_id
       JOIN chapters ch ON ch.id = l.chapter_id
      WHERE ch.course_id = $1
      ORDER BY a.sort_order, a.created_at`,
    [course.id]
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
        type: r.type,
        content: r.content,
        videoUrl: r.video_url,
        duration: r.duration,
        order: r.sort_order,
        isFree: r.is_free,
        attachments: files
          .filter((f) => f.lesson_id === r.id)
          .map((f) => ({ id: f.id, url: f.url, name: f.name, size: f.size })),
      });
    }
  }

  const students = await q(
    `SELECT u.id, u.email, u.display_name, e.customer_code, e.status, e.enrolled_at
       FROM enrollments e JOIN users u ON u.id = e.user_id
      WHERE e.course_id = $1 ORDER BY e.enrolled_at DESC`,
    [course.id]
  );

  res.json({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    coverUrl: course.cover_url,
    price: course.price,
    published: course.published,
    chapters,
    students: students.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.display_name,
      customerCode: s.customer_code,
      status: s.status,
      enrolledAt: s.enrolled_at,
    })),
  });
});

/** PUT /admin/courses/:id */
adminRouter.put("/courses/:id", async (req, res) => {
  const { title, description, coverUrl, price, published, slug } = req.body ?? {};
  if (slug !== undefined && !/^[a-z0-9-]+$/.test(String(slug))) {
    return res.status(400).json({ message: "slug ใช้ได้เฉพาะ a-z, 0-9 และ - เท่านั้น" });
  }

  await q(
    `UPDATE courses
        SET slug        = COALESCE($1, slug),
            title       = COALESCE($2, title),
            description = COALESCE($3, description),
            cover_url   = COALESCE($4, cover_url),
            price       = COALESCE($5, price),
            published   = COALESCE($6, published)
      WHERE id = $7`,
    [
      slug ?? null,
      title ?? null,
      description ?? null,
      coverUrl ?? null,
      toInt(price),
      published === undefined ? null : !!published,
      req.params.id,
    ]
  );
  res.json({ ok: true });
});

/** DELETE /admin/courses/:id — ลบบท/บทเรียน/สิทธิ์เรียนตามไปด้วย (ON DELETE CASCADE) */
adminRouter.delete("/courses/:id", async (req, res) => {
  await q("DELETE FROM courses WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- chapters */

adminRouter.post("/courses/:id/chapters", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ message: "ต้องมีชื่อบท" });

  const next = await q1<{ n: number }>(
    "SELECT coalesce(max(sort_order), 0) + 1 AS n FROM chapters WHERE course_id = $1",
    [req.params.id]
  );
  const row = await q1(
    "INSERT INTO chapters (course_id, title, sort_order) VALUES ($1, $2, $3) RETURNING id",
    [req.params.id, title, next!.n]
  );
  res.status(201).json({ id: row!.id });
});

adminRouter.put("/chapters/:id", async (req, res) => {
  const { title, order } = req.body ?? {};
  await q(
    `UPDATE chapters SET title = COALESCE($1, title), sort_order = COALESCE($2, sort_order) WHERE id = $3`,
    [title ?? null, toInt(order), req.params.id]
  );
  res.json({ ok: true });
});

adminRouter.delete("/chapters/:id", async (req, res) => {
  await q("DELETE FROM chapters WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------------- lessons */

adminRouter.post("/chapters/:id/lessons", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ message: "ต้องมีชื่อบทเรียน" });

  const next = await q1<{ n: number }>(
    "SELECT coalesce(max(sort_order), 0) + 1 AS n FROM lessons WHERE chapter_id = $1",
    [req.params.id]
  );
  const row = await q1(
    `INSERT INTO lessons (chapter_id, title, type, video_url, content, duration, sort_order, is_free)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      req.params.id,
      title,
      String(req.body?.type ?? "video"),
      req.body?.videoUrl ?? null,
      req.body?.content ?? null,
      toInt(req.body?.duration, 0),
      next!.n,
      !!req.body?.isFree,
    ]
  );
  res.status(201).json({ id: row!.id });
});

adminRouter.put("/lessons/:id", async (req, res) => {
  const { title, description, type, videoUrl, content, duration, order, isFree } = req.body ?? {};
  await q(
    `UPDATE lessons
        SET title       = COALESCE($1, title),
            description = COALESCE($2, description),
            type        = COALESCE($3, type),
            video_url   = COALESCE($4, video_url),
            content     = COALESCE($5, content),
            duration    = COALESCE($6, duration),
            sort_order  = COALESCE($7, sort_order),
            is_free     = COALESCE($8, is_free)
      WHERE id = $9`,
    [
      title ?? null,
      description ?? null,
      type ?? null,
      videoUrl ?? null,
      content ?? null,
      toInt(duration),
      toInt(order),
      isFree === undefined ? null : !!isFree,
      req.params.id,
    ]
  );
  res.json({ ok: true });
});

adminRouter.delete("/lessons/:id", async (req, res) => {
  await q("DELETE FROM lessons WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- ไฟล์แนบ */

/** POST /admin/lessons/:id/attachments — { url, name, size } */
adminRouter.post("/lessons/:id/attachments", async (req, res) => {
  const url = String(req.body?.url ?? "").trim();
  const name = String(req.body?.name ?? "").trim();
  if (!url || !name) return res.status(400).json({ message: "ต้องมีทั้งลิงก์และชื่อไฟล์" });

  const lesson = await q1("SELECT 1 FROM lessons WHERE id = $1", [req.params.id]);
  if (!lesson) return res.status(404).json({ message: "ไม่พบบทเรียน" });

  const next = await q1<{ n: number }>(
    "SELECT coalesce(max(sort_order), 0) + 1 AS n FROM attachments WHERE lesson_id = $1",
    [req.params.id]
  );
  const row = await q1(
    `INSERT INTO attachments (lesson_id, url, name, size, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [req.params.id, url, name, toInt(req.body?.size, 0), next!.n]
  );
  res.status(201).json({ id: row!.id });
});

/** DELETE /admin/attachments/:id — ลบเฉพาะแถวใน DB ไฟล์บน Cloudinary ยังอยู่ */
adminRouter.delete("/attachments/:id", async (req, res) => {
  await q("DELETE FROM attachments WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------ หมวดหมู่คอมมูนิตี้ */

/** GET /admin/categories — รวมที่ปิดใช้งานด้วย */
adminRouter.get("/categories", async (_req, res) => {
  const rows = await q(
    `SELECT c.id, c.slug, c.label, c.sort_order, c.active,
            (SELECT count(*) FROM posts WHERE category = c.slug)::int AS post_count
       FROM post_categories c ORDER BY c.sort_order, c.label`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      order: r.sort_order,
      active: r.active,
      postCount: r.post_count,
    }))
  );
});

/** POST /admin/categories — { slug, label, order? } */
adminRouter.post("/categories", async (req, res) => {
  const slug = String(req.body?.slug ?? "").trim();
  const label = String(req.body?.label ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ message: "slug ใช้ได้เฉพาะ a-z, 0-9 และ - เท่านั้น" });
  }
  if (!label) return res.status(400).json({ message: "ต้องมีชื่อหมวดหมู่" });
  if (await q1("SELECT 1 FROM post_categories WHERE slug = $1", [slug])) {
    return res.status(409).json({ message: "slug นี้ถูกใช้แล้ว" });
  }

  const next = await q1<{ n: number }>("SELECT coalesce(max(sort_order), 0) + 1 AS n FROM post_categories");
  const row = await q1(
    "INSERT INTO post_categories (slug, label, sort_order) VALUES ($1, $2, $3) RETURNING id",
    [slug, label, toInt(req.body?.order, next!.n)]
  );
  res.status(201).json({ id: row!.id });
});

/** PUT /admin/categories/:id — { label?, order?, active? } (slug แก้ไม่ได้ เพราะโพสต์อ้างอิงอยู่) */
adminRouter.put("/categories/:id", async (req, res) => {
  const { label, order, active } = req.body ?? {};
  await q(
    `UPDATE post_categories
        SET label      = COALESCE($1, label),
            sort_order = COALESCE($2, sort_order),
            active     = COALESCE($3, active)
      WHERE id = $4`,
    [label ?? null, toInt(order), active === undefined ? null : !!active, req.params.id]
  );
  res.json({ ok: true });
});

/** DELETE /admin/categories/:id — ลบไม่ได้ถ้ายังมีโพสต์อยู่ (ให้ปิดใช้งานแทน) */
adminRouter.delete("/categories/:id", async (req, res) => {
  const cat = await q1<{ slug: string }>("SELECT slug FROM post_categories WHERE id = $1", [req.params.id]);
  if (!cat) return res.status(404).json({ message: "ไม่พบหมวดหมู่นี้" });

  const used = await q1<{ n: number }>("SELECT count(*)::int AS n FROM posts WHERE category = $1", [cat.slug]);
  if (used!.n > 0) {
    return res.status(409).json({ message: `มีโพสต์ในหมวดนี้ ${used!.n} รายการ — ปิดใช้งานแทนการลบ` });
  }

  await q("DELETE FROM post_categories WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------- students / enrollment */

/** POST /admin/courses/:id/students — { email } ให้สิทธิ์เรียน */
adminRouter.post("/courses/:id/students", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const user = await q1<{ id: string }>("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้อีเมลนี้ (ต้องสมัครสมาชิกก่อน)" });

  await q(
    `INSERT INTO enrollments (user_id, course_id, customer_code)
     VALUES ($1, $2, $3) ON CONFLICT (user_id, course_id) DO NOTHING`,
    [user.id, req.params.id, String(req.body?.customerCode ?? "")]
  );
  res.status(201).json({ ok: true });
});

/** DELETE /admin/courses/:id/students/:userId */
adminRouter.delete("/courses/:id/students/:userId", async (req, res) => {
  await q("DELETE FROM enrollments WHERE course_id = $1 AND user_id = $2", [
    req.params.id,
    req.params.userId,
  ]);
  res.json({ ok: true });
});

/** GET /admin/students?search= */
adminRouter.get("/students", async (req, res) => {
  const search = `%${String(req.query.search ?? "").trim()}%`;
  const rows = await q(
    `SELECT u.id, u.email, u.display_name, u.phone, u.line_id, u.role, u.created_at,
            (SELECT count(*) FROM enrollments WHERE user_id = u.id)::int AS course_count
       FROM users u
      WHERE $1 = '%%' OR u.email ILIKE $1 OR coalesce(u.display_name, '') ILIKE $1
      ORDER BY u.created_at DESC`,
    [search]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.display_name,
      phone: r.phone,
      lineId: r.line_id,
      role: r.role,
      createdAt: r.created_at,
      courseCount: r.course_count,
    }))
  );
});

/** GET /admin/students/:id — ข้อมูลผู้ใช้ + คอร์สที่เรียน + ความคืบหน้า */
adminRouter.get("/students/:id", async (req, res) => {
  const user = await q1("SELECT * FROM users WHERE id = $1", [req.params.id]);
  if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้นี้" });

  const courses = await q(
    `SELECT c.id, c.title, c.slug, e.customer_code, e.status, e.enrolled_at,
            count(l.id)::int AS total,
            count(p.lesson_id) FILTER (WHERE p.completed)::int AS completed
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN chapters ch ON ch.course_id = c.id
       LEFT JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
      WHERE e.user_id = $1
      GROUP BY c.id, e.customer_code, e.status, e.enrolled_at
      ORDER BY e.enrolled_at DESC`,
    [req.params.id]
  );

  res.json({
    id: user.id,
    email: user.email,
    name: user.display_name,
    phone: user.phone,
    lineId: user.line_id,
    role: user.role,
    businessName: user.business_name,
    province: user.province,
    createdAt: user.created_at,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      customerCode: c.customer_code,
      status: c.status,
      enrolledAt: c.enrolled_at,
      total: c.total,
      completed: c.completed,
      percent: c.total ? Math.round((c.completed / c.total) * 100) : 0,
    })),
  });
});

/* --------------------------------------------------------------- คำสั่งซื้อ */

/** GET /admin/orders?status= */
adminRouter.get("/orders", async (req, res) => {
  const status = String(req.query.status ?? "all");
  const rows = await q(
    `SELECT o.id, o.amount, o.method, o.status, o.reference, o.note, o.created_at, o.paid_at,
            c.title AS course_title, u.email, u.display_name
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       JOIN users u ON u.id = o.user_id
      WHERE $1 = 'all' OR o.status = $1
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [status]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      status: r.status,
      reference: r.reference,
      note: r.note,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      courseTitle: r.course_title,
      email: r.email,
      name: r.display_name,
    }))
  );
});

/**
 * PUT /admin/orders/:id/status — { status: "paid" | "failed" }
 * อนุมัติรายการแจ้งโอน (paid = ให้สิทธิ์เรียนทันที) หรือปฏิเสธ
 */
adminRouter.put("/orders/:id/status", async (req, res) => {
  const status = String(req.body?.status ?? "");
  if (!["paid", "failed"].includes(status)) return res.status(400).json({ message: "status ไม่ถูกต้อง" });

  const order = await q1("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อนี้" });

  if (status === "paid") {
    await q(
      `INSERT INTO enrollments (user_id, course_id, customer_code)
       VALUES ($1, $2, $3) ON CONFLICT (user_id, course_id) DO NOTHING`,
      [order.user_id, order.course_id, order.reference]
    );
    await q("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1", [order.id]);
  } else {
    await q("UPDATE orders SET status = 'failed' WHERE id = $1", [order.id]);
  }

  res.json({ ok: true });
});

/** PUT /admin/students/:id/role — { role: "user" | "admin" } */
adminRouter.put("/students/:id/role", async (req, res) => {
  const role = String(req.body?.role ?? "");
  if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "role ไม่ถูกต้อง" });
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ message: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" });
  }

  await q("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);
  res.json({ ok: true });
});
