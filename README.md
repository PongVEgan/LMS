# LMS Web

ระบบเรียนออนไลน์ (frontend) — Next.js App Router
โครงมาจากส่วน `/learn` ของโปรเจกต์เดิม แล้วถอดแบรนด์/หลังบ้าน/หน้าขายออกทั้งหมด เพื่อพัฒนาต่อเป็นระบบของตัวเอง

## Stack

Next.js 16 (App Router) · React 19 · TailwindCSS 4 · next-auth v5 (beta) · Cloudflare Workers (@opennextjs/cloudflare)

## โครงสร้าง

```
src/
  app/
    layout.tsx                       — root layout (ฟอนต์ Prompt + theme bootstrap)
    page.tsx                         — หน้าแรก (public): hero + รายการคอร์ส + CTA
    icon.svg                         — favicon
    globals.css                      — Tailwind + ตัวแปรธีม --lms-*
    api/auth/[...nextauth]/route.ts  — Auth.js route handler
    learn/
      layout.tsx                     — Sidebar + theme toggle + SessionProvider
      page.tsx                       — Dashboard คอร์ส (ที่เรียนได้ + ที่ยังไม่มีสิทธิ์)
      [slug]/page.tsx                — รายละเอียดคอร์ส (chapters + lessons)
      [slug]/[lessonId]/page.tsx     — เครื่องเล่นบทเรียน (YouTube / text / file)
      community/                     — ฟีดคอมมูนิตี้ + โพสต์ + รายชื่อสมาชิก
      login | register               — เข้าสู่ระบบ / สมัคร (email + password)
      forgot-password | reset-password
      profile/page.tsx               — โปรไฟล์ผู้ใช้ + ประวัติการสั่งซื้อ
      certificates/                  — เกียรติบัตรของฉัน + ใบเกียรติบัตร (พิมพ์เป็น PDF ได้)
      checkout/[slug]/page.tsx       — ซื้อคอร์ส (ชำระเงินจำลอง)
    verify/[code]/page.tsx           — ตรวจสอบเกียรติบัตร (สาธารณะ ไม่ต้องล็อกอิน)
    admin/
      layout.tsx                     — sidebar หลังบ้าน (ธีม dark, กัน role ซ้ำอีกชั้น)
      page.tsx                       — ภาพรวม: ตัวเลขรวม + กราฟสมัครใหม่ + คอร์สยอดนิยม
      courses/page.tsx               — รายการคอร์ส + สร้างคอร์สใหม่
      courses/[id]/page.tsx          — แก้คอร์ส: เนื้อหา / ตั้งค่า / ผู้เรียน
      students/page.tsx              — ผู้ใช้ทั้งหมด + ค้นหา + รายละเอียด + ตั้งแอดมิน
      orders/page.tsx                — คำสั่งซื้อ + อนุมัติการแจ้งโอน
      reports/page.tsx               — รายงานตามช่วงเวลา + export CSV
      categories/page.tsx            — หมวดหมู่คอมมูนิตี้
  auth.ts                            — next-auth config (Credentials: email + password)
  middleware.ts                      — บังคับ login สำหรับ /learn/*
  lib/
    fetch-utils.ts                   — base URL ของ API + fetch timeout
    learn-fetch.ts                   — helper ยิง API พร้อม header x-user-email
    admin-fetch.ts                   — helper ยิง /admin/* + แปลงความยาวคลิป
    site.ts                          — ชื่อเว็บ / Turnstile key
    video.ts                         — แปลงลิงก์ YouTube ทุกรูปแบบเป็น embed URL
server/                              — backend (ดูหัวข้อถัดไป)
scripts/dev.mjs                      — รัน web + api พร้อมกัน
docker-compose.yml                   — Postgres สำหรับ dev
docs/API.md                          — สเปค endpoint ทั้งหมด
```

## Backend

อยู่ใน `server/` — Express 5 + TypeScript + Postgres (รันด้วย tsx ไม่ต้อง build)
ทำครบทุก endpoint ใน `docs/API.md` แล้ว

```
server/src/
  index.ts              — express app + mount routes + /api/health
  db/pool.ts            — pg pool + helper q() / q1()
  db/schema.sql         — โครงตาราง (รันซ้ำได้ ลบของเดิมก่อนเสมอ)
  db/reset.ts           — สร้างตาราง + seed ข้อมูลตัวอย่าง
  lib/password.ts       — hash รหัสผ่านด้วย scrypt (crypto ในตัว ไม่มี native module)
  lib/user.ts           — อ่าน x-user-email → req.user, requireUser / requireAdmin
  routes/auth.ts        — login, register, profile, reset password
  routes/learn.ts       — คอร์ส, บทเรียน, progress
  routes/community.ts   — ฟีด, คอมเมนต์, ไลก์, leaderboard, สมาชิก
  routes/admin.ts       — หลังบ้าน: stats, คอร์ส, บทเรียน, ผู้เรียน, คำสั่งซื้อ
  routes/checkout.ts    — ซื้อคอร์ส (ชำระเงินจำลอง)
  routes/uploads.ts     — ลายเซ็นอัปโหลดรูปขึ้น Cloudinary
  routes/public.ts      — คอร์ส/สถิติสำหรับหน้าแรก (ไม่ต้องล็อกอิน)
```

จุดต่อฝั่ง frontend อยู่ที่ `src/lib/fetch-utils.ts` (base URL) และ `src/lib/learn-fetch.ts`
ตอนนี้ระบุตัวตนด้วย header `x-user-email` ซึ่ง **ปลอมได้ ใช้ได้แค่ตอน dev**
ก่อนขึ้นจริงต้องเปลี่ยนเป็น JWT — แก้ที่ `learn-fetch.ts` (ฝั่งส่ง) กับ `lib/user.ts` (ฝั่งตรวจ)

## ENV (`.env.local`)

```
AUTH_SECRET=                        # openssl rand -base64 32
AUTH_TRUST_HOST=true
LMS_API_URL=http://localhost:3001/api
NEXT_PUBLIC_LMS_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SITE_NAME=LMS           # ชื่อบน sidebar / title
NEXT_PUBLIC_TURNSTILE_SITE_KEY=     # เว้นว่าง = ไม่ใช้ Turnstile
```

ทั้งหมดมีดีฟอลต์ในโค้ดอยู่แล้ว ยกเว้น `AUTH_SECRET` ที่ต้องตั้งเอง

## รัน local dev

ครั้งแรก:

```bash
npm run setup     # ลง dependency ทั้ง web และ server
npm run db:up     # เปิด Postgres ใน Docker (พอร์ต 5433)
npm run db:reset  # สร้างตาราง + ข้อมูลตัวอย่าง
```

ใช้งานประจำวัน:

```bash
npm run dev       # รัน web (3000) + api (3001) พร้อมกัน — Ctrl+C ปิดทั้งคู่
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | web + api พร้อมกัน (log ขึ้นพร้อมกันแยกสี `[web]` / `[api]`) |
| `npm run dev:web` / `npm run dev:api` | รันแยกทีละตัว |
| `npm run dev:kill` | ปิด process ที่ค้างพอร์ต 3000/3001 |
| `npm run db:up` / `npm run db:down` | เปิด/ปิด Postgres container |
| `npm run db:reset` | ⚠️ **ลบข้อมูลทั้งหมด** แล้ว seed ใหม่ |
| `npm run db:seed:web` | เพิ่มคอร์สสายเขียนเว็บ 3 คอร์ส (ไม่ลบของเดิม รันซ้ำได้) |
| `npm run db:backup` | สำรอง DB เป็นไฟล์ `.sql` ใน `backups/` (เก็บ 10 ไฟล์ล่าสุด) |

**บัญชีทดสอบ** (รหัสเดียวกันหมด `password123`):

| อีเมล | สภาพ |
|---|---|
| `student@example.com` | มีคอร์ส 1 คอร์ส เรียนไปแล้ว 25% |
| `admin@example.com` | role = admin (ปักหมุด/ประกาศในคอมมูนิตี้ได้) |
| `member@example.com` | ยังไม่มีคอร์ส ใช้ทดสอบหน้าล็อก |

> ต้องเปิด Docker Desktop ก่อน `npm run db:up`
> ลืมรหัสผ่านตอน dev ยังไม่ส่งอีเมลจริง — ลิงก์ reset จะปริ้นใน log ฝั่ง `[api]`

**ถ้าปิดเทอร์มินัลแบบไม่ได้กด Ctrl+C** เซิร์ฟเวอร์ลูกจะค้างเป็น orphan และ **route `/api/auth/*`
จะเริ่มตอบ 500 เป็น HTML** (เพราะ stdout ของมันชี้ไปที่ process แม่ที่ตายแล้ว → EPIPE)
อาการที่เห็นฝั่ง browser คือ `ClientFetchError: Unexpected token '<'` แล้วล็อกอินไม่ได้
แก้ด้วย `npm run dev:kill` แล้ว `npm run dev` ใหม่

## สำรอง / กู้คืนข้อมูล

โค้ดอยู่บน git แต่**ข้อมูลอยู่ใน Docker volume ไม่ได้ขึ้น git** ต้องสำรองแยก:

```bash
npm run db:backup    # -> backups/lms-YYYYMMDD-HHMM.sql
```

กู้คืน:

```bash
docker exec -i lms-postgres psql -U lms -d lms < backups/lms-20260818-0401.sql
```

โฟลเดอร์ `backups/` อยู่ใน `.gitignore` เพราะไฟล์ dump มีอีเมลผู้ใช้และ hash รหัสผ่าน

## build / deploy (frontend)

```bash
npm run build
npm run deploy    # opennextjs build + wrangler deploy
```

> `package-lock.json` ยกมาจากโปรเจกต์ต้นทาง เพราะ `@opennextjs/cloudflare` เวอร์ชันใหม่ (1.20.x)
> ประกาศ peer `next` ที่ไม่รับ 16.2.4 — ติดตั้งใหม่แบบไม่มี lockfile จะ ERESOLVE

## หลังบ้าน (`/admin`)

**วิธีเข้า:** ล็อกอินด้วยบัญชีที่ `role = admin` → เมนู **"หลังบ้าน"** โผล่ที่มุมล่างซ้ายของ sidebar
หรือเข้า http://localhost:3000/admin ตรงๆ (บัญชี seed: `admin@example.com` / `password123`)

บัญชีทั่วไปที่เผลอเข้า `/admin` จะถูก middleware เด้งกลับ `/learn` ส่วนคนที่ยังไม่ล็อกอินเด้งไปหน้า login

| หน้า | ทำอะไรได้ |
|---|---|
| `/admin` | จำนวนผู้ใช้ / สิทธิ์เรียน / คอร์ส / บทเรียน / บทที่เรียนจบ / โพสต์ · กราฟสมัครใหม่ 30 วัน · คอร์สยอดนิยม |
| `/admin/courses` | ดูคอร์สทั้งหมดพร้อมจำนวนบท-บทเรียน-ผู้เรียน · สร้างคอร์สใหม่ |
| `/admin/courses/[id]` | **เนื้อหา:** เพิ่ม/แก้/ลบ บทและบทเรียน (video/text/file, ลิงก์ YouTube, ความยาว, ดูฟรี)<br>**ตั้งค่า:** ชื่อ slug ราคา คำอธิบาย รูปปก เผยแพร่/ฉบับร่าง · ลบคอร์ส<br>**ผู้เรียน:** ให้สิทธิ์ด้วยอีเมล · ถอนสิทธิ์ |
| `/admin/students` | ค้นหาผู้ใช้ · ดูคอร์สและความคืบหน้ารายคน · ตั้ง/ถอดสิทธิ์แอดมิน |
| `/admin/orders` | คำสั่งซื้อทั้งหมด กรองตามสถานะ · อนุมัติ/ปฏิเสธรายการแจ้งโอน |
| `/admin/categories` | หมวดหมู่คอมมูนิตี้ — เพิ่ม/แก้ชื่อ/จัดลำดับ/ปิดใช้งาน |
| `/admin/reports` | รายงานตามช่วงเวลา 4 มุม (คอร์ส/ผู้เรียน/ยอดขาย/เกียรติบัตร) + ปุ่ม export CSV |

**การตั้งแอดมินคนแรก** ทำที่ฐานข้อมูลโดยตรง (ต้องมีแอดมินก่อนถึงจะตั้งคนอื่นได้):

```bash
docker exec -it lms-postgres psql -U lms -d lms \
  -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
```
เปลี่ยน role แล้วต้อง **ออกจากระบบแล้วล็อกอินใหม่** เพราะ role ฝังอยู่ใน JWT ที่ออกตอนล็อกอิน

ช่องกรอกวิดีโอตรวจให้ทันทีว่าลิงก์เป็น YouTube ไหม ถ้าไม่ใช่จะขึ้นเตือนสีแดงและติดป้าย
"ลิงก์ไม่ใช่ YouTube" ที่รายการบทเรียนด้วย

## ซื้อคอร์ส (ระบบชำระเงินจำลอง)

⚠️ **ไม่มีการตัดเงินจริง** ยังไม่ได้ต่อ payment gateway — เป็นของจำลองไว้ทดสอบ flow เท่านั้น

ผู้เรียนกด "ซื้อคอร์ส" จากหน้าคอร์สหรือแคตตาล็อก → ไปหน้า `/learn/checkout/[slug]` เลือกช่องทาง:

| ช่องทาง | เกิดอะไรขึ้น |
|---|---|
| **บัตรเครดิต/เดบิต** | ตัดสินผลจากเลขบัตรทดสอบ สำเร็จ = ได้สิทธิ์เรียนทันที |
| **QR พร้อมเพย์** | แสดง QR จำลอง (สแกนไม่ได้จริง) กดยืนยัน = ได้สิทธิ์เรียนทันที |
| **โอนผ่านบัญชี** | แจ้งโอน → สถานะ "รอตรวจสอบ" → แอดมินอนุมัติที่ `/admin/orders` ถึงจะได้สิทธิ์ |

**บัตรทดสอบ**

| เลขบัตร | ผล |
|---|---|
| `4242 4242 4242 4242` | ชำระสำเร็จ |
| `4000 0000 0000 0002` | บัตรถูกปฏิเสธ |
| `4000 0000 0000 0069` | บัตรหมดอายุ |
| `4000 0000 0000 0127` | CVC ไม่ถูกต้อง |

ผู้เรียนดูประวัติสั่งซื้อได้ที่หน้า `/learn/profile` · แอดมินดูทุกรายการและอนุมัติการโอนที่ `/admin/orders`

## แบบทดสอบ

สร้างที่หน้าแอดมิน: แก้บทเรียน → เปลี่ยน type เป็น **quiz** → บันทึก → กดแก้ไขอีกครั้งจะมีตัวสร้างข้อสอบ

- คำถามปรนัย **เลือกคำตอบเดียว** หรือ **เลือกได้หลายข้อ** (ต้องตรงทั้งชุดถึงได้คะแนน)
- ตั้งเกณฑ์ผ่าน (%) · จำกัดเวลา (นาที) · จำกัดจำนวนครั้ง · สลับลำดับข้อ
- ใส่คำอธิบายเฉลยรายข้อได้ — โผล่ให้ผู้เรียนเห็น**หลังส่งคำตอบแล้วเท่านั้น**
- ผู้เรียนสอบผ่าน = ระบบติ๊กบทเรียนนั้นว่าเรียนจบให้เลย

**ความปลอดภัย:** API ฝั่งผู้เรียนไม่ส่งเฉลยออกไปก่อนส่งคำตอบ (ทดสอบแล้วว่าไม่หลุด) และการตรวจทำที่เซิร์ฟเวอร์ทั้งหมด

## เกียรติบัตร

ระบบออกให้**อัตโนมัติ**เมื่อผู้เรียน **เรียนครบทุกบทเรียน + สอบผ่านทุกแบบทดสอบ** ในคอร์สนั้น

| หน้า | ใคร |
|---|---|
| `/learn/certificates` | ผู้เรียน — รายการเกียรติบัตรของตัวเอง |
| `/learn/certificates/[code]` | ผู้เรียน — ใบเกียรติบัตร กดพิมพ์/บันทึกเป็น PDF ได้ (A4 แนวนอน) |
| `/verify/[code]` | **ใครก็ได้** — ตรวจสอบว่าเกียรติบัตรจริงไหม ไม่ต้องล็อกอิน |

เลขที่รูปแบบ `CERT-XXXXXXXX` · 1 ใบต่อคอร์สต่อคน · หน้าตรวจสอบคืนแค่ชื่อผู้ถือกับชื่อคอร์ส ไม่เปิดเผยอีเมล

## รูปภาพ (Cloudinary)

อัปโหลดได้ 2 จุด:

| จุด | ใคร | เก็บที่ |
|---|---|---|
| รูปปกคอร์ส — `/admin/courses/[id]` แท็บ "ตั้งค่าคอร์ส" | แอดมิน | โฟลเดอร์ `lms/courses` |
| รูปแนบโพสต์ — ปุ่ม "แนบรูป" ในหน้า `/learn/community` | ผู้เรียนทุกคน | โฟลเดอร์ `lms/community` |
| ไฟล์ประกอบบทเรียน — ในฟอร์มแก้บทเรียน (PDF/Word/Excel/ZIP ไม่เกิน 20MB) | แอดมิน | โฟลเดอร์ `lms/attachments` |

วิธีทำงาน: browser ขอลายเซ็นจาก `POST /uploads/signature` แล้วส่งไฟล์**ตรงเข้า Cloudinary**
`CLOUDINARY_API_SECRET` อยู่แค่ใน `server/.env` ไม่เคยหลุดถึง browser และไฟล์ไม่วิ่งผ่าน API ของเรา

รับเฉพาะ JPG / PNG / WebP / GIF ไม่เกิน 5MB มีแถบแสดงเปอร์เซ็นต์ระหว่างอัปโหลด
ตั้งค่าคีย์ที่ `server/.env` (ดู `server/.env.example`) — ไม่ตั้งค่าก็ใช้ระบบส่วนอื่นได้ปกติ
แค่กดอัปโหลดแล้วจะขึ้นว่ายังไม่ได้ตั้งค่า

## วิดีโอบทเรียน

`videoUrl` ของบทเรียนใช้ **ลิงก์ YouTube** ก๊อปมาวางแบบไหนก็ได้:

```
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID?t=90          → เริ่มเล่นวินาทีที่ 90
https://www.youtube.com/shorts/VIDEO_ID
https://www.youtube.com/live/VIDEO_ID
VIDEO_ID                                 → ใส่แค่ id ก็ได้
```

คลิปต้องเป็น **Unlisted** หรือ Public (Private จะเล่นไม่ได้)

**ติดตามการดู:** เล่นผ่าน YouTube IFrame API ระบบจึงรู้ว่าดูถึงวินาทีไหน
กลับมาเปิดใหม่จะ**เล่นต่อจากจุดเดิม** และเมื่อ**ดูถึง 90% ระบบติ๊กว่าเรียนจบให้เอง**
(ยังกดปุ่ม "เรียนจบแล้ว" เองได้เหมือนเดิม) มีแถบบอก % ที่ดูไปแล้วใต้วิดีโอ
รองรับ YouTube อย่างเดียว — ลิงก์อื่นจะขึ้นข้อความ "ลิงก์วิดีโอไม่ถูกต้อง"

## ธีม

Light/Dark toggle เก็บใน localStorage key `lms-theme`
สีทั้งหมดอยู่ในตัวแปร `--lms-*` ที่ `globals.css` (`[data-theme="light"]` / `[data-theme="dark"]`)
เปลี่ยนสีแบรนด์ = แก้ `--lms-accent` ที่เดียว
