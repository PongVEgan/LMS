/**
 * สำรองฐานข้อมูลเป็นไฟล์ .sql: npm run db:backup
 * เก็บไว้ใน backups/ (อยู่ใน .gitignore เพราะมีอีเมลผู้ใช้และ hash รหัสผ่าน)
 *
 * คืนค่ากลับ:  docker exec -i lms-postgres psql -U lms -d lms < backups/<ไฟล์>.sql
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "backups";
const CONTAINER = "lms-postgres";
const KEEP = 10; // เก็บย้อนหลังกี่ไฟล์

// "2026-08-18 04:00:57" -> "20260818-0400" (เวลาไทย)
const stamp = new Date()
  .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
  .replace(/[- :]/g, "")
  .slice(0, 12)
  .replace(/^(\d{8})(\d{4})$/, "$1-$2");

mkdirSync(DIR, { recursive: true });
const file = join(DIR, `lms-${stamp}.sql`);

try {
  const dump = execFileSync(
    "docker",
    ["exec", CONTAINER, "pg_dump", "-U", "lms", "-d", "lms", "--clean", "--if-exists"],
    { maxBuffer: 512 * 1024 * 1024 }
  );
  writeFileSync(file, dump);
  console.log(`✓ สำรองแล้ว: ${file} (${(dump.length / 1024).toFixed(0)} KB)`);
} catch (err) {
  console.error("สำรองไม่สำเร็จ — Docker หรือ container lms-postgres ทำงานอยู่หรือเปล่า?");
  console.error(err.message);
  process.exit(1);
}

// ลบไฟล์เก่าที่เกินโควตา
const files = readdirSync(DIR)
  .filter((f) => f.startsWith("lms-") && f.endsWith(".sql"))
  .map((f) => ({ f, t: statSync(join(DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

if (files.length > KEEP) {
  for (const { f } of files.slice(KEEP)) {
    execFileSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", join(DIR, f)] : [join(DIR, f)]);
    console.log(`  ลบไฟล์เก่า: ${f}`);
  }
}
