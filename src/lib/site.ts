// ชื่อที่แสดงบนหัวเว็บ/sidebar — เปลี่ยนได้โดยไม่ต้องแก้โค้ด
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LMS";

// การซื้อคอร์สใช้หน้า /learn/checkout/[slug] ในระบบเอง (ระบบชำระเงินจำลอง)
// จึงไม่มี CHECKOUT_URL ไปเว็บภายนอกแล้ว

// Cloudflare Turnstile — ถ้าไม่ตั้งค่า หน้า login/register จะข้ามการยืนยันไปเลย
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
