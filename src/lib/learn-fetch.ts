import { fetchWithTimeout, LMS_API } from "./fetch-utils";

export { LMS_API };

export function getUserEmail(): string {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("learn-email") || "";
  }
  return "";
}

function resolveEmail(email?: string): string {
  return email || getUserEmail();
}

export async function learnFetch(path: string, init?: RequestInit, email?: string): Promise<Response> {
  const e = resolveEmail(email);
  const headers = new Headers(init?.headers);
  if (e) headers.set("x-user-email", e);
  return fetchWithTimeout(`${LMS_API}${path}`, { ...init, headers });
}

export async function learnPost(path: string, body: any, email?: string): Promise<Response> {
  const e = resolveEmail(email);
  return fetchWithTimeout(`${LMS_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": e },
    body: JSON.stringify(body),
  });
}

export async function learnPut(path: string, body: any, email?: string): Promise<Response> {
  const e = resolveEmail(email);
  return fetchWithTimeout(`${LMS_API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-user-email": e },
    body: JSON.stringify(body),
  });
}

export async function learnDelete(path: string, email?: string): Promise<Response> {
  const e = resolveEmail(email);
  return fetchWithTimeout(`${LMS_API}${path}`, {
    method: "DELETE",
    headers: { "x-user-email": e },
  });
}
