import { Router } from "express";
import { createHash } from "node:crypto";
import { requireUser } from "../lib/user.js";

export const uploadsRouter = Router();
uploadsRouter.use(requireUser);

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY = process.env.CLOUDINARY_API_KEY || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

/**
 * โฟลเดอร์ที่อนุญาต — กันไม่ให้ client ส่ง folder อะไรก็ได้เข้ามา
 * key = ชื่อที่ frontend ส่งมา, value = path จริงบน Cloudinary
 */
const FOLDERS: Record<string, { path: string; adminOnly: boolean; resourceType: "image" | "auto" }> = {
  course: { path: "lms/courses", adminOnly: true, resourceType: "image" },
  community: { path: "lms/community", adminOnly: false, resourceType: "image" },
  // ไฟล์แนบบทเรียน — resource_type "auto" ให้ Cloudinary แยกเองว่าเป็นรูปหรือ raw (pdf/zip/xlsx)
  attachment: { path: "lms/attachments", adminOnly: true, resourceType: "auto" },
};

/**
 * POST /uploads/signature — { folder }
 *
 * เซ็นพารามิเตอร์ให้ browser เอาไปอัปโหลดตรงเข้า Cloudinary
 * (ไฟล์ไม่ต้องวิ่งผ่าน API ตัวนี้ และ api_secret ไม่เคยออกจากเซิร์ฟเวอร์)
 */
uploadsRouter.post("/signature", (req, res) => {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return res.status(503).json({ message: "ยังไม่ได้ตั้งค่า Cloudinary ในไฟล์ server/.env" });
  }

  const key = String(req.body?.folder ?? "");
  const folder = FOLDERS[key];
  if (!folder) return res.status(400).json({ message: "folder ไม่ถูกต้อง" });
  if (folder.adminOnly && req.user!.role !== "admin") {
    return res.status(403).json({ message: "ต้องเป็นแอดมินเท่านั้น" });
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // ลายเซ็น = sha1 ของพารามิเตอร์ที่จะส่ง (เรียงตามตัวอักษร) + api_secret
  // ต้องตรงกับที่ browser ส่งไป Cloudinary เป๊ะๆ ไม่งั้นโดนปฏิเสธ
  const params: Record<string, string> = {
    folder: folder.path,
    timestamp: String(timestamp),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + API_SECRET).digest("hex");

  res.json({
    cloudName: CLOUD_NAME,
    apiKey: API_KEY,
    timestamp,
    signature,
    folder: folder.path,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${folder.resourceType}/upload`,
  });
});
