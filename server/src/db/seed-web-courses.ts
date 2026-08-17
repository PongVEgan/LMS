/**
 * เพิ่มคอร์สสายเขียนเว็บ 3 คอร์ส — ไม่ลบ ไม่แตะข้อมูลเดิม
 * มี slug อยู่แล้วจะข้ามคอร์สนั้นไป (รันซ้ำได้)
 *
 *   npm --prefix server run db:seed:web
 *
 * คลิปทั้งหมดเช็กแล้วว่ามีอยู่จริงและ embed ได้ (ผ่าน YouTube oEmbed)
 * ความยาวเป็นค่าจริงที่ดึงมาจากหน้าคลิป
 */
import { pool, q, q1 } from "./pool.js";

interface SeedLesson {
  title: string;
  type?: "video" | "text" | "file";
  videoId?: string;
  duration: number;
  description?: string;
  content?: string;
  isFree?: boolean;
}
interface SeedChapter { title: string; lessons: SeedLesson[] }
interface SeedCourse {
  slug: string;
  title: string;
  description: string;
  price: number;
  chapters: SeedChapter[];
}

const COURSES: SeedCourse[] = [
  {
    slug: "html-css-basics",
    title: "พื้นฐานเว็บ HTML & CSS",
    description: "เริ่มจากศูนย์จนสร้างหน้าเว็บได้เอง — โครงสร้าง HTML, จัดสไตล์ด้วย CSS, วางเลย์เอาต์ด้วย Flexbox และ Grid แล้วทำให้ใช้ได้ทุกขนาดหน้าจอ",
    price: 1500,
    chapters: [
      {
        title: "บทที่ 1 · รู้จัก HTML",
        lessons: [
          { title: "โครงสร้างหน้าเว็บด้วย HTML", videoId: "UB1O30fR-EE", duration: 3642, isFree: true,
            description: "แท็กพื้นฐาน โครงหน้าเว็บ และการจัดกลุ่มเนื้อหา" },
          { title: "HTML เจาะลึกอีกมุม", videoId: "qz0aGYrrlhU", duration: 4173,
            description: "ทบทวนอีกรอบจากผู้สอนอีกคน เก็บรายละเอียดที่ตกหล่น" },
        ],
      },
      {
        title: "บทที่ 2 · จัดหน้าตาด้วย CSS",
        lessons: [
          { title: "CSS เบื้องต้น", videoId: "yfoY53QXEnI", duration: 5111,
            description: "selector, สี, ตัวอักษร, ระยะห่าง และ box model" },
          { title: "สรุป CSS ใน 20 นาที", videoId: "1PnVor36_40", duration: 1424,
            description: "ทบทวนเร็วๆ ก่อนลงมือทำจริง" },
          { title: "วางเลย์เอาต์ด้วย Flexbox", videoId: "JJSoEo8JSnc", duration: 1199 },
          { title: "วางเลย์เอาต์ด้วย CSS Grid", videoId: "0xMQfnTU6oo", duration: 3225 },
        ],
      },
      {
        title: "บทที่ 3 · เว็บที่ใช้ได้ทุกหน้าจอ",
        lessons: [
          { title: "Responsive Web Design", videoId: "srvUrASNj0s", duration: 15064,
            description: "media query และการออกแบบให้รองรับมือถือ" },
          { title: "เช็กลิสต์ก่อนส่งงาน", type: "text", duration: 300,
            content: "ก่อนส่งงานลูกค้า ตรวจ 8 ข้อนี้ให้ครบ\n\n1. เปิดบนมือถือแล้วไม่มีแถบเลื่อนแนวนอน\n2. รูปทุกใบมี alt บอกว่าเป็นรูปอะไร\n3. ปุ่มและลิงก์กดได้จริงบนจอสัมผัส (สูงอย่างน้อย 44px)\n4. สีตัวอักษรกับพื้นหลังตัดกันพอให้อ่านออก\n5. หน้าเว็บโหลดได้ภายใน 3 วินาทีบนเน็ตมือถือ\n6. มี title และ description ให้ Google เก็บ\n7. ฟอร์มทุกช่องมี label กำกับ\n8. กด Tab ไล่ทั้งหน้าได้โดยไม่หลงทาง" },
        ],
      },
    ],
  },
  {
    slug: "javascript-react",
    title: "JavaScript & React สำหรับงานจริง",
    description: "ต่อยอดจาก HTML/CSS ไปเขียนเว็บที่โต้ตอบได้ — JavaScript, TypeScript, React และ Next.js พร้อมจัดสไตล์ด้วย Tailwind",
    price: 2900,
    chapters: [
      {
        title: "บทที่ 1 · JavaScript พื้นฐาน",
        lessons: [
          { title: "JavaScript เริ่มต้นแบบรวบรัด", videoId: "hdI2bqOjy3c", duration: 6030, isFree: true,
            description: "ตัวแปร ฟังก์ชัน array object และการสั่งงาน DOM" },
          { title: "JavaScript ฉบับเต็ม", videoId: "PkZNo7MFNFg", duration: 12403,
            description: "คอร์สยาวสำหรับคนที่อยากปูพื้นให้แน่น" },
        ],
      },
      {
        title: "บทที่ 2 · TypeScript",
        lessons: [
          { title: "TypeScript เบื้องต้น", videoId: "BCg4U1FzODs", duration: 3147,
            description: "ใส่ type ให้โค้ด ลดบั๊กตั้งแต่ยังไม่รัน" },
        ],
      },
      {
        title: "บทที่ 3 · React และ Next.js",
        lessons: [
          { title: "React เบื้องต้น", videoId: "w7ejDZ8SWv8", duration: 6527,
            description: "component, props, state และ hooks" },
          { title: "Next.js เบื้องต้น", videoId: "mTz0GXj8NN0", duration: 4185,
            description: "routing, การดึงข้อมูล และการ deploy" },
          { title: "จัดสไตล์ด้วย Tailwind CSS", videoId: "UBOj6rqRUME", duration: 1831 },
        ],
      },
    ],
  },
  {
    slug: "nodejs-backend",
    title: "Backend & API ด้วย Node.js",
    description: "สร้างเซิร์ฟเวอร์และ REST API ของตัวเอง — Node.js, Express, ฐานข้อมูล และการใช้ Git ทำงานร่วมกับทีม",
    price: 3900,
    chapters: [
      {
        title: "บทที่ 1 · Node.js และ Express",
        lessons: [
          { title: "Node.js เบื้องต้น", videoId: "fBNz5xF-Kx4", duration: 5407, isFree: true,
            description: "รัน JavaScript นอกเบราว์เซอร์ และระบบ module" },
          { title: "Express JS", videoId: "L72fhGm1tfE", duration: 4441,
            description: "routing, middleware และการรับส่งข้อมูล" },
        ],
      },
      {
        title: "บทที่ 2 · ฐานข้อมูลและ REST API",
        lessons: [
          { title: "MongoDB เบื้องต้น", videoId: "-56x56UppqQ", duration: 2202 },
          { title: "สร้าง REST API ด้วย Node + Express", videoId: "pKd0Rpw7O48", duration: 3519,
            description: "ออกแบบ endpoint ให้อ่านง่ายและใช้งานจริงได้" },
        ],
      },
      {
        title: "บทที่ 3 · เครื่องมือที่ต้องใช้",
        lessons: [
          { title: "Git & GitHub", videoId: "SWYqp7iY_Tc", duration: 1962,
            description: "commit, branch, merge และการทำงานร่วมกับคนอื่น" },
          { title: "แนวทางฝึกต่อหลังจบคอร์ส", type: "text", duration: 240,
            content: "จบคอร์สแล้วทำอะไรต่อ\n\n1. ทำโปรเจกต์จริง 1 ตัวที่ตัวเองอยากใช้เอง — ไม่ต้องใหญ่ ขอให้จบ\n2. เอาขึ้น GitHub ทุกครั้ง แม้จะเป็นโค้ดที่ยังไม่สวย\n3. อ่านโค้ดคนอื่นในโปรเจกต์ open source ที่ใช้อยู่จริง\n4. ฝึกอ่าน error ให้เป็น ก่อนจะไปถามคนอื่นหรือถาม AI\n5. เขียนบันทึกสั้นๆ ว่าวันนี้ติดอะไรและแก้ยังไง" },
        ],
      },
    ],
  },
];

async function main() {
  for (const course of COURSES) {
    if (await q1("SELECT 1 FROM courses WHERE slug = $1", [course.slug])) {
      console.log(`- ข้าม "${course.title}" (slug ${course.slug} มีอยู่แล้ว)`);
      continue;
    }

    const created = await q1<{ id: string }>(
      `INSERT INTO courses (slug, title, description, price, published)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [course.slug, course.title, course.description, course.price]
    );

    let lessonCount = 0;
    for (const [ci, chapter] of course.chapters.entries()) {
      const ch = await q1<{ id: string }>(
        "INSERT INTO chapters (course_id, title, sort_order) VALUES ($1, $2, $3) RETURNING id",
        [created!.id, chapter.title, ci + 1]
      );

      for (const [li, lesson] of chapter.lessons.entries()) {
        await q(
          `INSERT INTO lessons (chapter_id, title, description, type, content, video_url, duration, sort_order, is_free)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            ch!.id,
            lesson.title,
            lesson.description ?? null,
            lesson.type ?? "video",
            lesson.content ?? null,
            lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}` : null,
            lesson.duration,
            li + 1,
            lesson.isFree ?? false,
          ]
        );
        lessonCount++;
      }
    }

    const totalMin = Math.round(
      course.chapters.flatMap((c) => c.lessons).reduce((sum, l) => sum + l.duration, 0) / 60
    );
    console.log(`✓ ${course.title} — ${course.chapters.length} บท ${lessonCount} บทเรียน (รวม ${totalMin} นาที) ฿${course.price.toLocaleString()}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
