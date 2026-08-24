# LMS Web

frontend ระบบเรียนออนไลน์ — โปรเจกต์อิสระ (ไม่ผูกกับ repo หรือแบรนด์เดิมแล้ว)

## Project
- **Frontend:** Next.js 16 + React 19 + TailwindCSS 4 (พอร์ต 3000)
- **Backend:** `server/` — Express 5 + TypeScript + Postgres (พอร์ต 3001, prefix `/api`)
- **DB:** Postgres ใน Docker (`docker-compose.yml`, host port **5433**)
- **Deploy (web):** Cloudflare Workers via @opennextjs/cloudflare + wrangler (`name: lms-web`)
- สเปค endpoint ทั้งหมดอยู่ใน `docs/API.md` — **แก้ route แล้วต้องอัปเดตไฟล์นี้ด้วย**

## รัน dev
```bash
npm run setup     # ครั้งแรก: ลง dep ทั้ง web + server
npm run db:up     # Postgres ใน Docker (ต้องเปิด Docker Desktop ก่อน)
npm run db:reset  # สร้างตาราง + seed
npm run dev       # web + api พร้อมกัน (โหมดพัฒนา — เปิดหน้าครั้งแรกช้า 20-60 วิ เป็นเรื่องปกติ)
npm run demo      # โหมดสาธิต — build ก่อนแล้วรัน ทุกหน้าเปิดใน 0.2 วิ ใช้ตอนโชว์งาน
```
> **ห้ามเปิด dev server ค้างข้ามวัน** — Next.js dev มี memory leak พอทะลุ threshold
> จะ restart ตัวเองแล้วค้างครึ่งๆ กลางๆ (พอร์ตเปิดแต่ไม่ตอบสนอง) แก้ด้วย `npm run dev:kill`
บัญชีทดสอบ: `student@example.com` / `admin@example.com` / `member@example.com` — รหัส `password123`

## Structure
```
src/
  app/
    page.tsx                         — หน้าแรก public (server component, force-dynamic)
    layout.tsx                       — ฟอนต์ Prompt + theme bootstrap script
    icon.svg                         — favicon
    globals.css                      — Tailwind + ตัวแปร --lms-* (light/dark)
    api/auth/[...nextauth]/route.ts  — Auth.js route handler
    learn/
      layout.tsx                     — Sidebar + theme + SessionProvider
      page.tsx                       — Course dashboard
      [slug]/page.tsx                — Course detail (chapters + lessons)
      [slug]/[lessonId]/page.tsx     — Lesson player (YouTube/text/file)
      community/                     — feed + post detail + members
      login | register | forgot-password | reset-password | profile
      checkout/[slug]/               — ซื้อคอร์ส (ชำระเงินจำลอง)
    admin/                           — หลังบ้าน (ต้อง role = admin)
      page.tsx (ภาพรวม) · courses/ (list + editor) · students/ · orders/
  auth.ts                            — next-auth config (Credentials: email + password)
  middleware.ts                      — บังคับ login /learn/* + กัน role admin ที่ /admin/*
  lib/                               — fetch-utils, learn-fetch, admin-fetch, upload, site, video
  components/ImageUpload.tsx         — ปุ่มอัปโหลดรูปใช้ร่วมทุกจุด
server/src/
  index.ts                           — express app + /api/health
  db/pool.ts · db/schema.sql · db/reset.ts
  lib/password.ts (scrypt) · lib/user.ts (requireUser / requireAdmin)
  routes/public.ts (ไม่ต้อง auth) · routes/auth.ts · routes/learn.ts · routes/community.ts
  routes/admin.ts · routes/checkout.ts · routes/uploads.ts
  routes/quiz.ts (แบบทดสอบ) · routes/certificates.ts · routes/reports.ts
  lib/completion.ts — เช็กจบคอร์ส + ออกเกียรติบัตรอัตโนมัติ
```

## Admin (`/admin`)
- กัน 2 ชั้น: `middleware.ts` (เด้ง `/learn` ถ้า role ไม่ใช่ admin) + เช็คซ้ำใน `admin/layout.tsx`
  ฝั่ง API ทุกเส้น `/api/admin/*` ผ่าน `requireAdmin`
- role ฝังอยู่ใน JWT ตอนล็อกอิน → **เปลี่ยน role ในฐานข้อมูลแล้วต้อง logout/login ใหม่**
- ตั้งแอดมินคนแรกด้วย SQL: `UPDATE users SET role='admin' WHERE email='...'`
- ธีมหลังบ้านล็อก `data-theme="dark"` ไว้ ไม่ตามปุ่มสลับธีมของฝั่งผู้เรียน
- ยังไม่มี: เลื่อนลำดับบท/บทเรียนแบบลากวาง (API รับ `order` แล้ว UI ยังไม่มีปุ่ม)

## หน้าแรก (`/`)
- **public** — middleware ไม่ได้กัน ใครก็เปิดได้ ดึงคอร์สจาก `GET /public/courses`
- เป็น server component + `export const dynamic = "force-dynamic"` — **ห้ามเอาออก** ไม่งั้น
  `next build` จะพยายาม prerender แล้วยิง API ที่ยังไม่รัน
- API ล่ม → `getCourses()` คืน [] แล้วโชว์ "ยังไม่มีคอร์ส" แทนที่จะพังทั้งหน้า
- ปุ่ม/ลิงก์เปลี่ยนตาม session (`await auth()`): ล็อกอินแล้ว → เข้าห้องเรียน/ซื้อคอร์ส · ยังไม่ล็อกอิน → สมัคร/เข้าสู่ระบบ

## หมวดหมู่คอมมูนิตี้
- อยู่ในตาราง `post_categories` จัดการที่ `/admin/categories` — **ห้าม hardcode กลับลงโค้ด**
- `slug` แก้ไม่ได้หลังสร้าง (โพสต์เก็บ slug ไว้ตรงๆ) · หมวดที่มีโพสต์ลบไม่ได้ ให้ปิดใช้งานแทน

## แบบทดสอบ / เกียรติบัตร
- **ห้ามส่งเฉลย (`isCorrect`) ไปฝั่งผู้เรียนก่อนส่งคำตอบ** — `routes/quiz.ts` แยก query คนละชุดกับฝั่งแอดมินไว้แล้ว
- ตรวจข้อสอบที่เซิร์ฟเวอร์เท่านั้น · เลือกหลายข้อต้องตรงทั้งชุดถึงได้คะแนน
- สอบผ่าน → ติ๊ก progress ของบทเรียนนั้นให้อัตโนมัติ
- เกียรติบัตรออกอัตโนมัติผ่าน `checkCourseCompletion()` เมื่อ **เรียนครบทุกบท + สอบผ่านทุกชุด**
  เรียกจากทั้ง `POST /learn/progress` (ทางอ้อม) และตอนส่งข้อสอบ
- `/verify/[code]` เป็นหน้า public — คืนแค่ชื่อผู้ถือกับคอร์ส **ห้ามเพิ่มอีเมลหรือข้อมูลติดต่อลงไป**
- โหมดพิมพ์ใช้ class `.no-print` + `.cert` ใน `globals.css` (A4 แนวนอน)

## รายงาน
- `/admin/reports` — ทุก endpoint รับ `from`/`to` · CSV สร้างฝั่ง browser ที่ `src/lib/csv.ts`
- **CSV ต้องมี BOM** (`﻿`) ไม่งั้น Excel บน Windows อ่านภาษาไทยเป็นตัวยึกยือ

## กติกาสำคัญ
- **ห้าม hardcode โดเมน/คีย์/ชื่อแบรนด์ลงในโค้ด** — ทุกอย่างผ่าน env ใน `src/lib/site.ts`
  กับ `src/lib/fetch-utils.ts` (`SITE_NAME`, `TURNSTILE_SITE_KEY`, `LMS_API_URL`)
- Theme: ใช้ CSS variables `[data-theme="light"/"dark"]` ห้าม hardcode สี
- Mobile: ทุกหน้าต้อง responsive (px-4 mobile, px-6 desktop)

## Auth
- **next-auth v5 beta** — Credentials provider อย่างเดียว (อีเมล + รหัสผ่าน ยิงไป `POST /auth/login`)
- **ไม่มี Google OAuth** — ตัดออกแล้ว อย่าเพิ่มกลับถ้าไม่ได้สั่ง
- **Turnstile เป็น optional** — ไม่ตั้ง `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = ข้ามการยืนยันไปเลย
- Middleware: `/learn/*` ต้อง login — หน้า login/register/forgot/reset เป็น public
- การระบุตัวตนกับ backend ใช้ header `x-user-email` — **ปลอมได้ ใช้ได้แค่ dev**
  ส่งที่ `src/lib/learn-fetch.ts` ตรวจที่ `server/src/lib/user.ts` ก่อนขึ้นจริงต้องเปลี่ยนเป็น JWT ทั้งสองฝั่ง

## Checkout (ชำระเงินจำลอง)
- **ไม่มีเงินจริง** — `server/src/routes/checkout.ts` ตัดสินผลจากเลขบัตรทดสอบ แล้วสร้าง `enrollments` เอง
  `4242…4242` สำเร็จ · `4000…0002` ถูกปฏิเสธ · `4000…0069` หมดอายุ · `4000…0127` CVC ผิด
- `qr` = กดยืนยันแล้วผ่านทันที · `transfer` = `awaiting_review` รอแอดมินอนุมัติที่ `/admin/orders`
- **client เป็นคนบอกว่าจ่ายแล้ว = ปลอมได้** ของจริงต้องยืนยันผ่าน webhook ของ gateway เท่านั้น
- ปุ่ม "ซื้อคอร์ส" ชี้ไป `/learn/checkout/[slug]` ในระบบ ไม่ใช่ลิงก์ออกนอกเว็บแล้ว

## รูปภาพ (Cloudinary)
- **signed direct upload** — `POST /api/uploads/signature` ออกลายเซ็น แล้ว browser ส่งไฟล์ตรงเข้า Cloudinary
  `api_secret` อยู่แค่ `server/.env` ห้ามย้ายไปฝั่ง client หรือใส่ใน `NEXT_PUBLIC_*` เด็ดขาด
- โฟลเดอร์ whitelist ที่ `server/src/routes/uploads.ts` — `course` (แอดมิน) / `community` (ทุกคน)
  เพิ่มจุดอัปโหลดใหม่ต้องเพิ่ม key ในนั้นก่อน
- UI: `src/components/ImageUpload.tsx` (รูป) · `src/components/AttachmentManager.tsx` (ไฟล์แนบบทเรียน)
  logic อยู่ `src/lib/upload.ts` → `uploadImage()` / `uploadFile()`
- ไฟล์แนบใช้ folder `attachment` → `/auto/upload` · **PDF/ZIP ต้องปลดล็อกที่ Cloudinary
  Settings → Security → Restricted media types ไม่งั้นดาวน์โหลดได้ 401**
- ยังไม่ลบไฟล์เก่าบน Cloudinary ตอนเปลี่ยนรูป (ไฟล์กำพร้าค้างไว้)

## Video
- เล่นผ่าน **YouTube IFrame API** (`src/components/YouTubePlayer.tsx`) ไม่ใช่ iframe ธรรมดา
  เพื่ออ่านตำแหน่งจริง → เล่นต่อจากจุดเดิม + รู้ % ที่ดู
- รายงานความคืบหน้าทุก 15 วินาที และตอนหยุด/สลับแท็บ/ออกจากหน้า
- **ดูถึง 90% ระบบติ๊กว่าเรียนจบให้เอง** (เกณฑ์อยู่ที่ `AUTO_COMPLETE_AT` ใน `server/src/routes/learn.ts`)
- **YouTube เท่านั้น** — `src/lib/video.ts` → `getYouTubeEmbedUrl()` รับลิงก์ทุกแบบ
  (`watch?v=`, `youtu.be/`, `embed/`, `shorts/`, `live/`, video id เปล่า) พร้อม `t` / `start` / `list`
- ลิงก์ที่ไม่ใช่ YouTube จะขึ้น "ลิงก์วิดีโอไม่ถูกต้อง" — ไม่มี player สำรอง อย่าเพิ่มกลับถ้าไม่ได้สั่ง

## สิ่งที่ยังไม่มี
- ระบบส่งอีเมลจริง (ยืนยันสมัคร · ลิงก์รีเซ็ตรหัส · แจ้งเกียรติบัตร)
- คำถามแบบเติมคำ/อัตนัย (มีเฉพาะปรนัย)
- ระบบชำระเงิน**จริง** — ตอนนี้เป็น mock ที่ `server/src/routes/checkout.ts` (ดูหัวข้อ Checkout)
- ใบเสร็จ / อีเมลยืนยันการสั่งซื้อ / คืนเงิน
- อัปโหลดวิดีโอและไฟล์แนบ (รูปอัปโหลดได้แล้ว วิดีโอยังรับเป็นลิงก์ YouTube)
- รูปโปรไฟล์ผู้ใช้ (ตาราง users ยังไม่มีคอลัมน์เก็บ)
