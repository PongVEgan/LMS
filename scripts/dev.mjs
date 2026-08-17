/**
 * รัน frontend + backend พร้อมกันด้วยคำสั่งเดียว: npm run dev
 * เขียนเองแทนการลง concurrently เพื่อไม่ต้องแตะ lockfile
 */
import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

const targets = [
  { name: "web", color: "\x1b[36m", args: ["run", "dev:web"] },
  { name: "api", color: "\x1b[35m", args: ["--prefix", "server", "run", "dev"] },
];

const RESET = "\x1b[0m";
const children = [];
let shuttingDown = false;

function prefix(name, color, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim() !== "") console.log(`${color}[${name}]${RESET} ${line}`);
  }
}

for (const t of targets) {
  // Windows: npm เป็นไฟล์ .cmd — Node ใหม่บังคับให้ต้องผ่าน shell ไม่งั้น spawn EINVAL
  const child = spawn("npm", t.args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  });
  children.push(child);

  child.stdout.on("data", (c) => prefix(t.name, t.color, c));
  child.stderr.on("data", (c) => prefix(t.name, t.color, c));

  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.log(`${t.color}[${t.name}]${RESET} จบการทำงาน (exit ${code}) — ปิดอีกตัวด้วย`);
    shutdown(code ?? 0);
  });

  child.on("error", (err) => {
    console.error(`${t.color}[${t.name}]${RESET} รันไม่ได้: ${err.message}`);
    shutdown(1);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode !== null || !c.pid) continue;
    // ผ่าน shell แล้ว child จริงเป็นลูกของ cmd.exe — ต้องปิดทั้งต้นไม้
    if (isWindows) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
