/**
 * เปิดหน้าเว็บจัดการฐานข้อมูล (Adminer): npm run db:ui
 * ใช้ตอนนำเสนอเพื่อโชว์ตารางและข้อมูลจริงโดยไม่ต้องติดตั้งโปรแกรมเพิ่ม
 */
import { execFileSync, spawn } from "node:child_process";

const URL = "http://localhost:8080";

try {
  execFileSync("docker", ["compose", "up", "-d", "adminer"], { stdio: "inherit" });
} catch {
  console.error("\nเปิดไม่สำเร็จ — Docker Desktop ทำงานอยู่หรือเปล่า?");
  process.exit(1);
}

console.log(`
เปิดหน้าจัดการฐานข้อมูลแล้ว: ${URL}

  ระบบฐานข้อมูล  PostgreSQL
  เซิร์ฟเวอร์     db          (เติมให้อัตโนมัติแล้ว)
  ผู้ใช้          lms
  รหัสผ่าน        lms
  ฐานข้อมูล       lms
`);

// เปิดเบราว์เซอร์ให้เลย (ถ้าเปิดไม่ได้ก็ไม่เป็นไร ผู้ใช้ก๊อป URL ไปเองได้)
const opener =
  process.platform === "win32" ? ["cmd", ["/c", "start", "", URL]]
  : process.platform === "darwin" ? ["open", [URL]]
  : ["xdg-open", [URL]];

try {
  spawn(opener[0], opener[1], { detached: true, stdio: "ignore" }).unref();
} catch {
  /* เปิดเองไม่ได้ ไม่ต้องแจ้ง */
}
