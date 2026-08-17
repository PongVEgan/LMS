// Base URL ของ backend — ตั้งผ่าน env (ห้าม hardcode โดเมนไว้ในโค้ด)
export const LMS_API =
  process.env.NEXT_PUBLIC_LMS_API_URL ||
  process.env.LMS_API_URL ||
  "http://localhost:3001/api";

export function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const merged = opts.signal ? opts : { ...opts, signal: controller.signal };
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, merged).finally(() => clearTimeout(timer));
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  opts: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const res = await fetchWithTimeout(
    `${LMS_API}${endpoint}`,
    { headers: { "Content-Type": "application/json", ...opts.headers }, ...opts },
    timeoutMs
  );

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname.startsWith("/learn")) {
    window.location.href = "/learn/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}
