import { Router } from "express";
import { q, q1 } from "../db/pool.js";
import { levelFromPoints, requireAdmin, requireUser } from "../lib/user.js";

export const communityRouter = Router();
communityRouter.use(requireUser);

// แต้ม: โพสต์ 10 · คอมเมนต์ 5 · ได้ไลก์ 2
const POINTS_SQL = `
  (SELECT count(*) * 10 FROM posts WHERE author_id = u.id)
+ (SELECT count(*) * 5  FROM comments WHERE author_id = u.id)
+ (SELECT count(*) * 2  FROM post_likes pl JOIN posts p2 ON p2.id = pl.post_id WHERE p2.author_id = u.id)
`;

function authorOf(r: any) {
  return {
    id: r.author_id,
    email: r.author_email,
    name: r.author_name || r.author_email?.split("@")[0] || "ผู้ใช้",
    businessName: r.author_business || null,
    industry: r.author_industry || null,
    level: levelFromPoints(Number(r.author_points ?? 0)),
  };
}

const POST_SELECT = `
  SELECT p.id, p.content, p.image_url, p.category, p.is_pinned, p.is_announcement, p.created_at,
         u.id AS author_id, u.email AS author_email, u.display_name AS author_name,
         u.business_name AS author_business, u.industry AS author_industry,
         (${POINTS_SQL}) AS author_points,
         (SELECT count(*) FROM post_likes WHERE post_id = p.id)::int AS like_count,
         (SELECT count(*) FROM comments WHERE post_id = p.id)::int AS comment_count,
         EXISTS (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS is_liked
    FROM posts p JOIN users u ON u.id = p.author_id
`;

function toPost(r: any) {
  return {
    id: r.id,
    content: r.content,
    imageUrl: r.image_url,
    category: r.category,
    isPinned: r.is_pinned,
    isAnnouncement: r.is_announcement,
    createdAt: r.created_at,
    author: authorOf(r),
    likeCount: r.like_count,
    commentCount: r.comment_count,
    isLiked: r.is_liked,
  };
}

/** GET /community/posts?category=&limit= */
communityRouter.get("/posts", async (req, res) => {
  const category = String(req.query.category ?? "all");
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const rows = await q(
    `${POST_SELECT}
      WHERE ($2 = 'all' OR p.category = $2)
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT $3`,
    [req.user!.id, category, limit]
  );
  res.json(rows.map(toPost));
});

/** POST /community/posts — { content, category, imageUrl? } */
communityRouter.post("/posts", async (req, res) => {
  const content = String(req.body?.content ?? "").trim();
  const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl) : null;
  if (!content && !imageUrl) return res.status(400).json({ message: "ยังไม่ได้เขียนอะไรเลย" });

  const row = await q1(
    "INSERT INTO posts (author_id, content, category, image_url) VALUES ($1, $2, $3, $4) RETURNING id",
    [req.user!.id, content, String(req.body?.category ?? "general"), imageUrl]
  );
  res.status(201).json({ id: row!.id });
});

/** GET /community/posts/:id — โพสต์ + คอมเมนต์ */
communityRouter.get("/posts/:id", async (req, res) => {
  const row = await q1(`${POST_SELECT} WHERE p.id = $2`, [req.user!.id, req.params.id]);
  if (!row) return res.status(404).json({ message: "ไม่พบโพสต์นี้" });

  const comments = await q(
    `SELECT c.id, c.content, c.created_at,
            u.id AS author_id, u.email AS author_email, u.display_name AS author_name,
            u.business_name AS author_business, u.industry AS author_industry,
            (${POINTS_SQL}) AS author_points,
            (SELECT count(*) FROM comment_likes WHERE comment_id = c.id)::int AS like_count,
            EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $1) AS is_liked
       FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $2
      ORDER BY c.created_at`,
    [req.user!.id, req.params.id]
  );

  res.json({
    ...toPost(row),
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: authorOf(c),
      likeCount: c.like_count,
      isLiked: c.is_liked,
    })),
  });
});

/** POST /community/posts/:id/comments — { content } */
communityRouter.post("/posts/:id/comments", async (req, res) => {
  const content = String(req.body?.content ?? "").trim();
  if (!content) return res.status(400).json({ message: "ยังไม่ได้เขียนคอมเมนต์" });

  const post = await q1("SELECT 1 FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ message: "ไม่พบโพสต์นี้" });

  const row = await q1(
    "INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING id",
    [req.params.id, req.user!.id, content]
  );
  res.status(201).json({ id: row!.id });
});

/** POST /community/posts/:id/like — toggle */
communityRouter.post("/posts/:id/like", async (req, res) => {
  const existing = await q1("SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2", [
    req.params.id,
    req.user!.id,
  ]);
  if (existing) {
    await q("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    return res.json({ liked: false });
  }
  await q("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [req.params.id, req.user!.id]);
  res.json({ liked: true });
});

/** POST /community/comments/:id/like — toggle */
communityRouter.post("/comments/:id/like", async (req, res) => {
  const existing = await q1("SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2", [
    req.params.id,
    req.user!.id,
  ]);
  if (existing) {
    await q("DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    return res.json({ liked: false });
  }
  await q("INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)", [req.params.id, req.user!.id]);
  res.json({ liked: true });
});

/** DELETE /community/posts/:id — เจ้าของโพสต์หรือแอดมิน */
communityRouter.delete("/posts/:id", async (req, res) => {
  const post = await q1<{ author_id: string }>("SELECT author_id FROM posts WHERE id = $1", [req.params.id]);
  if (!post) return res.status(404).json({ message: "ไม่พบโพสต์นี้" });
  if (post.author_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ message: "ลบได้เฉพาะโพสต์ของตัวเอง" });
  }

  await q("DELETE FROM posts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/** GET /community/leaderboard?period=7d */
communityRouter.get("/leaderboard", async (req, res) => {
  const days = Number(String(req.query.period ?? "7d").replace(/\D/g, "")) || 7;

  const rows = await q(
    `SELECT u.id, u.email, u.display_name,
            (  (SELECT count(*) * 10 FROM posts WHERE author_id = u.id AND created_at > now() - ($1 || ' days')::interval)
             + (SELECT count(*) * 5  FROM comments WHERE author_id = u.id AND created_at > now() - ($1 || ' days')::interval)
            )::int AS points,
            (${POINTS_SQL})::int AS total_points
       FROM users u
      ORDER BY points DESC, u.created_at
      LIMIT 10`,
    [String(days)]
  );

  res.json(
    rows
      .filter((r) => r.points > 0)
      .map((r, i) => ({
        rank: i + 1,
        name: r.display_name || r.email.split("@")[0],
        level: levelFromPoints(Number(r.total_points)),
        points: r.points,
      }))
  );
});

/** GET /community/members */
communityRouter.get("/members", async (_req, res) => {
  const rows = await q(
    `SELECT u.id, u.email, u.display_name, u.business_name, u.industry, u.province, u.created_at,
            (${POINTS_SQL})::int AS points,
            (SELECT count(*) FROM posts WHERE author_id = u.id)::int AS post_count
       FROM users u
      ORDER BY points DESC, u.created_at`
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.display_name,
      businessName: r.business_name || null,
      industry: r.industry || null,
      province: r.province || null,
      createdAt: r.created_at,
      level: levelFromPoints(r.points),
      points: r.points,
      postCount: r.post_count,
    }))
  );
});

/** GET /community/me */
communityRouter.get("/me", async (req, res) => {
  const u = req.user!;
  res.json({
    bio: u.bio,
    businessName: u.business_name,
    industry: u.industry,
    province: u.province,
  });
});

/** PUT /community/me */
communityRouter.put("/me", async (req, res) => {
  const { displayName, bio, businessName, industry, province } = req.body ?? {};
  await q(
    `UPDATE users
        SET display_name  = COALESCE($1, display_name),
            bio           = COALESCE($2, bio),
            business_name = COALESCE($3, business_name),
            industry      = COALESCE($4, industry),
            province      = COALESCE($5, province)
      WHERE id = $6`,
    [displayName ?? null, bio ?? null, businessName ?? null, industry ?? null, province ?? null, req.user!.id]
  );
  res.json({ ok: true });
});

/** แอดมินจัดการโพสต์ — mount ที่ /admin/community */
export const adminCommunityRouter = Router();
adminCommunityRouter.use(requireUser, requireAdmin);

adminCommunityRouter.put("/posts/:id/pin", async (req, res) => {
  await q("UPDATE posts SET is_pinned = $1 WHERE id = $2", [req.body?.pinned !== false, req.params.id]);
  res.json({ ok: true });
});

adminCommunityRouter.put("/posts/:id/announcement", async (req, res) => {
  await q("UPDATE posts SET is_announcement = $1 WHERE id = $2", [req.body?.announcement !== false, req.params.id]);
  res.json({ ok: true });
});
