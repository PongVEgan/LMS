// แปลงลิงก์ YouTube ที่ก๊อปมาวางแบบไหนก็ได้ ให้เป็น URL สำหรับ <iframe>
// รองรับ: watch?v= / youtu.be / embed / shorts / live / v / หรือใส่มาแค่ video id

const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function parseUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
}

/** "90" | "1m30s" | "1h2m3s" → วินาที (ไม่ตรงรูปแบบคืน 0) */
function parseTime(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export function getYouTubeId(raw: string): string | null {
  if (!raw) return null;
  if (ID_PATTERN.test(raw.trim())) return raw.trim();

  const url = parseUrl(raw);
  if (!url || !YT_HOSTS.includes(url.hostname)) return null;

  const parts = url.pathname.split("/").filter(Boolean);

  // youtu.be/<id>
  if (url.hostname.endsWith("youtu.be")) {
    return ID_PATTERN.test(parts[0] || "") ? parts[0] : null;
  }

  // /embed/<id> · /shorts/<id> · /live/<id> · /v/<id>
  if (["embed", "shorts", "live", "v"].includes(parts[0])) {
    return ID_PATTERN.test(parts[1] || "") ? parts[1] : null;
  }

  // /watch?v=<id>
  const v = url.searchParams.get("v");
  return v && ID_PATTERN.test(v) ? v : null;
}

/** คืน embed URL ถ้าเป็นลิงก์ YouTube — ไม่ใช่คืน null */
export function getYouTubeEmbedUrl(raw: string): string | null {
  const id = getYouTubeId(raw);
  if (!id) return null;

  const url = parseUrl(raw);
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });

  const start = parseTime(url?.searchParams.get("t") || url?.searchParams.get("start") || null);
  if (start > 0) params.set("start", String(start));

  const list = url?.searchParams.get("list");
  if (list) params.set("list", list);

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
