# สเปค Backend API

รายการ endpoint ทั้งหมดที่ frontend เรียก พร้อม field ที่ **ถูกอ่านไปใช้จริง**
(field อื่นที่ backend ส่งเกินมาไม่มีผล)

**ทั้งหมดนี้ implement แล้วใน `server/`** — แก้ route เมื่อไหร่ให้อัปเดตไฟล์นี้ด้วย

## หลักการร่วม

- **Base URL** มาจาก env `NEXT_PUBLIC_LMS_API_URL` / `LMS_API_URL` (ดีฟอลต์ `http://localhost:3001/api`)
  ทุก path ข้างล่างต่อท้าย base นี้
- **การระบุตัวตน:** ทุก request ที่ผ่าน `learnFetch/learnPost/learnPut/learnDelete` ส่ง header
  **`x-user-email: <อีเมลผู้ใช้>`** — backend ใช้ header นี้ระบุว่าใครเรียก
  ⚠️ ปลอมได้ ใช้ได้แค่ตอน dev — ก่อนขึ้นจริงต้องเปลี่ยนเป็น JWT
  (แก้ `src/lib/learn-fetch.ts` ฝั่งส่ง + `server/src/lib/user.ts` ฝั่งตรวจ)
- **`GET /health`** — เช็คว่า API และ DB ขึ้นอยู่ไหม (`{ ok, db }`)
- **Timeout:** ฝั่ง client ตัดที่ 15 วินาที
- **Error:** ตอบ non-2xx พร้อม body `{ "message": "ข้อความภาษาไทย" }` — หน้าเว็บเอา `message` ไปโชว์ตรงๆ
- **วันที่:** string ที่ `new Date()` parse ได้ (ISO 8601)

---

## 0. Public (ไม่ต้องล็อกอิน)

ใช้กับหน้าแรก `/` — เป็นกลุ่มเดียวที่ **ไม่ต้องส่ง** `x-user-email`

| Method | Path | คืนอะไร |
|---|---|---|
| GET | `/public/courses` | คอร์สที่ `published = true` + `lessonCount` `totalDuration` (วินาที) `studentCount` |
| GET | `/public/stats` | `{ courses, lessons, students }` |

---

## 1. Auth

เรียกจาก `src/auth.ts` และหน้า login/register/forgot/reset — **ไม่ได้ส่ง** `x-user-email`

### `POST /auth/login`
next-auth Credentials provider เรียกฝั่ง server

```jsonc
// request
{ "email": "a@b.com", "password": "..." }
// response 200
{ "userId": "...", "email": "a@b.com", "displayName": "ชื่อ" }
// ไม่ผ่าน → ตอบ non-2xx (หน้าเว็บโชว์ "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
```

### `POST /auth/register`

```jsonc
{ "email": "a@b.com", "password": "...", "displayName": "ชื่อ", "turnstileToken": "..." }
// 200 = สมัครสำเร็จ (หน้าเว็บเด้งไป /learn/login?registered=true)
// ผิดพลาด → non-2xx + { "message": "อีเมลนี้ถูกใช้แล้ว" }
```
`turnstileToken` จะเป็น `""` ถ้าไม่ได้ตั้ง `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

### `GET /auth/check-enrollment?email=<email>`
เรียกทุกครั้งที่ต่ออายุ JWT → ใส่ `role` ลง session

```jsonc
{ "role": "user" }   // หรือ "admin"
```

### `POST /auth/forgot-password`
```jsonc
{ "email": "a@b.com" }   // ตอบ 200 เสมอเพื่อไม่ให้เดาได้ว่าอีเมลมีอยู่จริงไหม
```

### `POST /auth/reset-password`
```jsonc
{ "token": "...", "password": "..." }   // token มาจาก query string ?token= ในลิงก์อีเมล
```

### `GET /auth/profile?email=<email>`
```jsonc
{
  "email": "a@b.com",
  "displayName": "ชื่อ",          // nullable
  "phone": null,
  "lineId": null,
  "hasPassword": true,             // false = ยังไม่ได้ตั้งรหัสผ่าน (ซ่อนฟอร์มเปลี่ยนรหัส)
  "createdAt": "2026-01-01T00:00:00Z",
  "courses": [
    { "title": "...", "slug": "...", "customerCode": "...", "status": "active",
      "enrolledAt": "2026-01-01T00:00:00Z", "totalLessons": 12, "completedLessons": 3, "percent": 25 }
  ]
}
```

### `POST /auth/update-profile`
ใช้ 2 กรณี ด้วย endpoint เดียว — แยกด้วย field ที่ส่งมา

```jsonc
// แก้ข้อมูลทั่วไป
{ "email": "a@b.com", "displayName": "ชื่อ", "phone": "08...", "lineId": "..." }
// เปลี่ยนรหัสผ่าน
{ "email": "a@b.com", "currentPassword": "...", "newPassword": "..." }
```

---

## 2. Learn (คอร์ส/บทเรียน)

### `GET /learn/my-courses`
คอร์สที่ผู้ใช้มีสิทธิ์เรียน — ตอบเป็น **array** (ถ้าไม่ใช่ array หน้าเว็บมองเป็นว่าง)

```jsonc
[{
  "id": "...", "slug": "...", "title": "...",
  "description": null, "coverUrl": null,
  "progress": { "total": 12, "completed": 3, "percent": 25 }
}]
```

### `GET /learn/catalog`
คอร์สทั้งหมดที่เปิดขาย (หน้าเว็บกรองตัวที่ซื้อแล้วออกเอง)

```jsonc
[{ "id": "...", "slug": "...", "title": "...", "description": null, "coverUrl": null, "price": 4900 }]
```

### `GET /learn/courses/:slug`
โครงสร้างคอร์ส + สถานะเรียนจบรายบท (ใช้ทั้งหน้าคอร์สและ sidebar)
**ไม่มีสิทธิ์เรียน → ตอบ non-2xx** หน้าเว็บจะโชว์ "คุณยังไม่มีสิทธิ์เรียนคอร์สนี้"

```jsonc
{
  "id": "...", "slug": "...", "title": "...", "description": null, "coverUrl": null,
  "chapters": [{
    "id": "...", "title": "บทที่ 1", "order": 1,
    "lessons": [{
      "id": "...", "title": "...", "description": null,
      "duration": 610,            // วินาที
      "order": 1,
      "type": "video",            // "video" | "text" | "file"
      "completed": false
    }]
  }]
}
```

### `GET /learn/lessons/:lessonId`

```jsonc
{
  "id": "...", "chapterId": "...", "courseId": "...",
  "title": "...", "description": null,
  "type": "video",
  "content": null,               // ใช้เมื่อ type = "text"
  "videoUrl": "https://www.youtube.com/watch?v=...",   // ต้องเป็นลิงก์ YouTube เท่านั้น
  "duration": 610, "order": 1, "isFree": false,
  "attachments": [{ "id": "...", "url": "https://...", "name": "สไลด์.pdf", "size": 102400 }]
}
```

### `POST /learn/progress`
ใช้ 2 แบบ — กดปุ่มเอง หรือรายงานอัตโนมัติจากเครื่องเล่นวิดีโอ

```jsonc
// กดปุ่ม "เรียนจบแล้ว"
{ "lessonId": "...", "completed": true }
// เครื่องเล่นรายงานทุก 15 วินาที (และตอนหยุด/ออกจากหน้า)
{ "lessonId": "...", "position": 125, "watchedPercent": 42, "watched": 15 }
// ตอบกลับ
{ "ok": true, "completed": false, "watchedPercent": 42, "position": 125 }
```
- `watchedPercent` เก็บเป็น **ค่าสูงสุดที่เคยดูถึง** — ถอยกลับไปดูซ้ำไม่ทำให้ลดลง
- `watched` = วินาทีที่ดูเพิ่มตั้งแต่รายงานครั้งก่อน ระบบบวกสะสมใน `watched_seconds`
- **แตะ 90% เมื่อไหร่ระบบติ๊กว่าเรียนจบให้เอง** · จบแล้วไม่ถอยกลับเป็นยังไม่จบ
  (ยกเว้นส่ง `completed: false` มาตรงๆ)
- `GET /learn/lessons/:id` คืน `progress: { completed, position, watchedPercent }` ให้เล่นต่อจากจุดเดิม

---

## 3. Community

### `GET /community/categories`
หมวดหมู่ที่เปิดใช้งาน เรียงตามลำดับที่แอดมินตั้ง — หน้าเว็บเอาไปทำแท็บกรองและตัวเลือกตอนโพสต์
```jsonc
[{ "slug": "general", "label": "ทั่วไป" }]
```

### `GET /community/posts?category=<cat>&limit=30`
`category` เป็น `all` หรือชื่อหมวด — ตอบ array

```jsonc
[{
  "id": "...", "content": "...", "imageUrl": null, "category": "general",
  "isPinned": false, "isAnnouncement": false, "createdAt": "...",
  "author": { "id": "...", "email": "...", "name": "...", "businessName": null, "industry": null, "level": 1 },
  "likeCount": 0, "commentCount": 0,
  "isLiked": false        // เทียบกับผู้เรียกจาก x-user-email
}]
```

### `POST /community/posts`
```jsonc
{ "content": "...", "category": "general", "imageUrl": null }
// category "introduction" ใช้กับโพสต์แนะนำตัวตอน onboard
// imageUrl มาจากการอัปโหลด (ดูหัวข้อ 5) — มีรูปอย่างเดียวไม่มีข้อความก็โพสต์ได้
```

### `GET /community/posts/:id`
เหมือน object ข้างบน + `comments`:
```jsonc
{ "...": "ฟิลด์เดียวกับ post",
  "comments": [{ "id": "...", "content": "...", "createdAt": "...",
                 "author": { "name": "...", "level": 1 }, "likeCount": 0, "isLiked": false }] }
```

### `POST /community/posts/:id/comments` → `{ "content": "..." }`
### `POST /community/posts/:id/like` → body `{}` (toggle)
### `POST /community/comments/:id/like` → body `{}` (toggle)
### `DELETE /community/posts/:id` — ลบโพสต์ (backend ต้องเช็คสิทธิ์เจ้าของ/แอดมินเอง)

### `GET /community/leaderboard?period=7d`
```jsonc
[{ "rank": 1, "name": "...", "level": 3, "points": 120 }]
```

### `GET /community/members`
```jsonc
[{ "id": "...", "email": "...", "name": null, "businessName": null, "industry": null,
   "province": null, "createdAt": "...", "level": 1, "points": 0, "postCount": 0 }]
```

### `GET /community/me`
โปรไฟล์ฝั่ง community ของผู้เรียก
```jsonc
{ "bio": "", "businessName": "", "industry": "", "province": "" }
```

### `PUT /community/me`
```jsonc
{ "displayName": "...", "bio": "...", "businessName": "...", "industry": "...", "province": "..." }
```

### แอดมินจัดการโพสต์ (เรียกจากหน้า community เมื่อ role = admin)
- `PUT /admin/community/posts/:id/pin` → `{ "pinned": true }`
- `PUT /admin/community/posts/:id/announcement` → `{ "announcement": true }`

---

## 4. Admin backoffice (`/admin/*`)

ทุกเส้นต้อง `x-user-email` ของบัญชีที่ `role = 'admin'` — ไม่ใช่แอดมินตอบ **403**

### `GET /admin/stats`
```jsonc
{
  "users": 3, "enrollments": 2, "courses": 2, "lessons": 4, "posts": 3, "completedLessons": 1,
  "signups": [{ "date": "2026-08-17", "count": 0 }],        // 30 วันย้อนหลัง วันที่ไม่มีคนสมัครก็ส่ง 0
  "topCourses": [{ "id": "...", "title": "...", "students": 2, "avgPercent": 25 }]
}
```

### คอร์ส
| Method | Path | Body / หมายเหตุ |
|---|---|---|
| GET | `/admin/courses` | + `chapterCount` `lessonCount` `studentCount` |
| POST | `/admin/courses` | `{ slug, title, description?, price?, published? }` — slug ต้องตรง `^[a-z0-9-]+$` ซ้ำ → 409 |
| GET | `/admin/courses/:id` | คอร์ส + `chapters[].lessons[]` (มี `content` / `videoUrl` ครบ) + `students[]` |
| PUT | `/admin/courses/:id` | ส่งเฉพาะ field ที่จะแก้ (`COALESCE` ฝั่ง SQL) |
| DELETE | `/admin/courses/:id` | ลบบท/บทเรียน/สิทธิ์เรียน/ความคืบหน้าตามไปด้วย |

### บท / บทเรียน
| Method | Path | Body |
|---|---|---|
| POST | `/admin/courses/:id/chapters` | `{ title }` — `sort_order` ต่อท้ายให้อัตโนมัติ |
| PUT / DELETE | `/admin/chapters/:id` | `{ title?, order? }` |
| POST | `/admin/chapters/:id/lessons` | `{ title, type?, videoUrl?, content?, duration?, isFree? }` |
| PUT / DELETE | `/admin/lessons/:id` | field เดียวกัน + `description?` `order?` |

### ไฟล์แนบบทเรียน
| Method | Path | Body / หมายเหตุ |
|---|---|---|
| POST | `/admin/lessons/:id/attachments` | `{ url, name, size }` — url ได้จากการอัปโหลด (หัวข้อ 6) |
| DELETE | `/admin/attachments/:id` | ลบเฉพาะแถวใน DB **ไฟล์บน Cloudinary ยังอยู่** |

`GET /admin/courses/:id` คืน `chapters[].lessons[].attachments[]` มาด้วยแล้ว

### หมวดหมู่คอมมูนิตี้
| Method | Path | Body / หมายเหตุ |
|---|---|---|
| GET | `/admin/categories` | รวมที่ปิดใช้งาน + `postCount` |
| POST | `/admin/categories` | `{ slug, label, order? }` — slug ตรง `^[a-z0-9-]+$` ซ้ำ → 409 |
| PUT | `/admin/categories/:id` | `{ label?, order?, active? }` — **slug แก้ไม่ได้** (โพสต์อ้างอิงอยู่) |
| DELETE | `/admin/categories/:id` | มีโพสต์ในหมวดนั้น → 409 ให้ปิดใช้งานแทน |

### ผู้เรียน
| Method | Path | Body / หมายเหตุ |
|---|---|---|
| POST | `/admin/courses/:id/students` | `{ email }` ให้สิทธิ์เรียน — ไม่มีอีเมลนี้ → 404 · ซ้ำ → เงียบ (idempotent) |
| DELETE | `/admin/courses/:id/students/:userId` | ถอนสิทธิ์ |
| GET | `/admin/students?search=` | ค้นจากอีเมลหรือชื่อ (ILIKE) |
| GET | `/admin/students/:id` | ข้อมูลผู้ใช้ + คอร์ส + ความคืบหน้ารายคอร์ส |
| PUT | `/admin/students/:id/role` | `{ role: "user" \| "admin" }` — เปลี่ยนของตัวเองไม่ได้ (400) |

---

## 5. Checkout (ระบบชำระเงินจำลอง)

**ไม่มีการตัดเงินจริง ไม่ต่อ payment gateway ใดๆ** ผลลัพธ์ตัดสินจากเลขบัตรทดสอบ
โค้ดอยู่ที่ `server/src/routes/checkout.ts` — จ่ายสำเร็จ = สร้างแถวใน `enrollments` ให้ทันที

สถานะออร์เดอร์: `pending` (เพิ่งสร้าง) → `paid` (ได้สิทธิ์เรียนแล้ว) · `awaiting_review` (แจ้งโอน รอแอดมิน) · `failed`

| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/checkout/courses/:slug` | ข้อมูลคอร์ส + `owned` (มีสิทธิ์เรียนอยู่แล้วไหม) |
| POST | `/checkout/orders` | `{ courseSlug, method }` — method: `card` \| `qr` \| `transfer` · มีสิทธิ์อยู่แล้ว → 409 |
| GET | `/checkout/orders` | ประวัติการสั่งซื้อของตัวเอง |
| GET | `/checkout/orders/:id` | ของคนอื่น → 404 (ไม่บอกว่ามีอยู่จริง) |
| POST | `/checkout/orders/:id/pay` | `{ cardNumber? }` — จ่ายซ้ำ → 409 |

**พฤติกรรมของแต่ละช่องทาง**
- `card` — ต้องส่ง `cardNumber` 16 หลัก (ไม่ครบ → 400) ผลตัดสินจากเลขบัตร:

  | เลขบัตร | ผล |
  |---|---|
  | `4242 4242 4242 4242` | สำเร็จ |
  | `4000 0000 0000 0002` | บัตรถูกปฏิเสธ (402) |
  | `4000 0000 0000 0069` | บัตรหมดอายุ (402) |
  | `4000 0000 0000 0127` | CVC ไม่ถูกต้อง (402) |
  | เลขอื่น 16 หลัก | สำเร็จ |

- `qr` — กดยืนยัน = `paid` ทันที (QR ที่แสดงเป็นภาพจำลอง สแกนไม่ได้จริง)
- `transfer` — เป็น `awaiting_review` รอแอดมินกดอนุมัติที่ `PUT /admin/orders/:id/status`

ฝั่งแอดมิน: `GET /admin/orders?status=` และ `PUT /admin/orders/:id/status` (`{ status: "paid" | "failed" }`)
อนุมัติแล้วให้สิทธิ์เรียนทันที

> **ก่อนใช้จริงต้องเปลี่ยนทั้งหมดนี้เป็น payment gateway จริง** — ตอนนี้ client เป็นคนบอกว่าจ่ายแล้ว
> ซึ่งปลอมได้ทั้งหมด ของจริงต้องยืนยันผลผ่าน webhook จากฝั่ง gateway เท่านั้น

---

## 6. อัปโหลดรูป (Cloudinary)

ใช้แบบ **signed direct upload** — ไฟล์วิ่งจาก browser ตรงเข้า Cloudinary
API ตัวนี้ออกแค่ลายเซ็นให้ `api_secret` จึงไม่เคยออกจากเซิร์ฟเวอร์ และไฟล์ไม่กิน bandwidth ของเรา

### `POST /uploads/signature` — `{ folder }`

```jsonc
// request — folder เป็น key ที่ whitelist ไว้เท่านั้น ส่งค่าอื่นได้ 400
{ "folder": "course" }     // "course" (แอดมิน) | "community" (ทุกคน) | "attachment" (แอดมิน)
// response
{
  "cloudName": "...", "apiKey": "...",
  "timestamp": 1786977642,
  "signature": "7202d6e6...",
  "folder": "lms/courses",
  "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/image/upload"
}
```

จากนั้น browser POST multipart ไปที่ `uploadUrl` ด้วย field
`file` · `api_key` · `timestamp` · `signature` · `folder` แล้วเอา `secure_url` ที่ได้ไปเก็บ
(`coverUrl` ของคอร์ส หรือ `imageUrl` ของโพสต์) — โค้ดฝั่ง client อยู่ที่ `src/lib/upload.ts`

**ลายเซ็น** = `sha1(<params เรียงตามตัวอักษร คั่นด้วย &> + api_secret)`
พารามิเตอร์ที่เซ็นต้องตรงกับที่ browser ส่งเป๊ะๆ — เพิ่ม field ใหม่ต้องเซ็นเพิ่มด้วยเสมอ

`uploadUrl` ต่างกันตามชนิดไฟล์: รูปใช้ `/image/upload` · ไฟล์แนบใช้ `/auto/upload`
(Cloudinary แยกเองว่าเป็นรูปหรือ raw — pdf/zip/docx จะไปเป็น `raw`)

⚠️ **PDF และ ZIP ถูกบล็อกการดาวน์โหลดโดยดีฟอลต์** (ตอบ HTTP 401) ต้องเปิดเองที่
Cloudinary Console → Settings → Security → **Restricted media types** → ปลดติ๊ก PDF และ ZIP

**ข้อจำกัดฝั่ง client**: รูป (`validateImage()`) JPG/PNG/WebP/GIF ไม่เกิน 5MB · ไฟล์แนบ (`uploadFile()`) ไม่เกิน 20MB
เป็นการกันแบบหน้าบ้าน ถ้าต้องการบังคับจริงจังให้ตั้ง restrictions ใน Cloudinary dashboard เพิ่ม

ENV ที่ต้องมีใน `server/.env`: `CLOUDINARY_CLOUD_NAME` · `CLOUDINARY_API_KEY` · `CLOUDINARY_API_SECRET`
ไม่ตั้งค่า → endpoint ตอบ **503** พร้อมข้อความบอกว่ายังไม่ได้ตั้งค่า (ส่วนอื่นใช้งานได้ปกติ)

---

## รายละเอียดที่ implement เพิ่มจากสเปค

- **แต้ม community:** โพสต์ 10 · คอมเมนต์ 5 · ได้ไลก์ 2 — เลเวล = `floor(points/100)+1` สูงสุด 5
  (`levelFromPoints()` ใน `server/src/lib/user.ts`)
- **leaderboard** นับเฉพาะแต้มที่ได้ในช่วง `period` แต่ level คิดจากแต้มสะสมทั้งหมด
- **ลบโพสต์** ได้เฉพาะเจ้าของหรือ admin · **pin/announcement** เฉพาะ admin
- **ลืมรหัสผ่าน:** token อายุ 1 ชั่วโมง ใช้ได้ครั้งเดียว — dev ยังไม่ส่งอีเมล ลิงก์ปริ้นใน log ฝั่ง api
- **รหัสผ่าน:** scrypt เก็บเป็น `scrypt:<salt>:<hash>` (ไม่ใช้ bcrypt เพื่อเลี่ยง native module)

## สิ่งที่ยัง**ไม่**มี (ต้องทำเพิ่มถ้าต้องการ)

- ระบบชำระเงิน**จริง** — ตอนนี้เป็นของจำลองทั้งหมด (ดูหัวข้อ 5)
- ใบเสร็จ / อีเมลยืนยันการสั่งซื้อ · การขอคืนเงิน
- อัปโหลด**วิดีโอ** — `videoUrl` ยังรับเป็นลิงก์ YouTube เท่านั้น (รูปอัปโหลดได้แล้ว)
- รูปโปรไฟล์ผู้ใช้ (avatar) — ตาราง `users` ยังไม่มีคอลัมน์เก็บ ต้องเพิ่ม schema ก่อน
- ลบไฟล์เก่าออกจาก Cloudinary ตอนเปลี่ยน/ลบ — ตอนนี้ไฟล์เดิมยังค้างอยู่บน Cloudinary
- แบบทดสอบ · เกียรติบัตร · รายงานเชิงลึก/export (ดูสรุป 9 process)
- สลับลำดับบท/บทเรียนแบบลากวาง — API รับ `order` แล้ว แต่ UI ยังไม่มีปุ่มเลื่อน
