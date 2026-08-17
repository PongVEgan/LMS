import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { learnRouter } from "./routes/learn.js";
import { adminCommunityRouter, communityRouter } from "./routes/community.js";
import { adminRouter } from "./routes/admin.js";
import { uploadsRouter } from "./routes/uploads.js";
import { checkoutRouter } from "./routes/checkout.js";
import { publicRouter } from "./routes/public.js";
import { quizRouter } from "./routes/quiz.js";
import { certificateRouter } from "./routes/certificates.js";
import { reportRouter } from "./routes/reports.js";
import { pool } from "./db/pool.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "down", message: (err as Error).message });
  }
});

app.use("/api/public", publicRouter);
app.use("/api/auth", authRouter);
// quiz/certificate อยู่ใต้ /api/learn เหมือนกัน ต้อง mount ก่อน learnRouter
// ไม่งั้น learnRouter จะกิน path ที่ชื่อคล้ายกันไปก่อน
app.use("/api/learn", quizRouter);
app.use("/api/learn", certificateRouter);
app.use("/api/learn", learnRouter);
app.use("/api/community", communityRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/checkout", checkoutRouter);
// /api/admin/community ต้องมาก่อน /api/admin เพราะ express จับตามลำดับที่ mount
app.use("/api/admin/community", adminCommunityRouter);
app.use("/api/admin/reports", reportRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => res.status(404).json({ message: "ไม่พบ endpoint นี้" }));

// error handler ตัวสุดท้าย — ตอบรูปแบบเดียวกับที่ frontend คาดไว้ { message }
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}/api`);
});
