/**
 * ปิด process ที่ค้างพอร์ต 3000 / 3001: npm run dev:kill
 * ใช้ตอน dev server กลายเป็น orphan (เช่น ปิดเทอร์มินัลแบบไม่ Ctrl+C)
 */
import { execSync } from "node:child_process";

const PORTS = [3000, 3001];
const isWindows = process.platform === "win32";

function pidsOnPort(port) {
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, {
        encoding: "utf8",
      });
      return [...new Set(out.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()))];
    }
    return execSync(`lsof -ti tcp:${port} -s tcp:LISTEN`, { encoding: "utf8" }).trim().split("\n");
  } catch {
    return []; // ไม่มีอะไรฟังพอร์ตนี้
  }
}

for (const port of PORTS) {
  const pids = pidsOnPort(port).filter(Boolean);
  if (pids.length === 0) {
    console.log(`พอร์ต ${port} ว่างอยู่แล้ว`);
    continue;
  }
  for (const pid of pids) {
    try {
      if (isWindows) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      else process.kill(Number(pid), "SIGKILL");
      console.log(`ปิด PID ${pid} ที่ค้างพอร์ต ${port} แล้ว`);
    } catch {
      console.log(`ปิด PID ${pid} ไม่สำเร็จ (อาจปิดไปแล้ว)`);
    }
  }
}
