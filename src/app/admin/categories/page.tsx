"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { adminDelete, adminGet, adminJson, adminPost, adminPut } from "@/lib/admin-fetch";

interface Category {
  id: string;
  slug: string;
  label: string;
  order: number;
  active: boolean;
  postCount: number;
}

export default function AdminCategoriesPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ slug: "", label: "" });

  const load = () =>
    adminGet("/categories")
      .then(adminJson<Category[]>)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    load();
  }, [session?.user?.email, status]);

  const show = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const run = async (fn: () => Promise<Response>, okMsg?: string) => {
    setError("");
    try {
      await adminJson(await fn());
      await load();
      if (okMsg) show(okMsg);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl font-bold">หมวดหมู่คอมมูนิตี้</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--lms-text-muted)" }}>
        ใช้เป็นตัวกรองและตัวเลือกตอนโพสต์ในหน้า Community
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {toast && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-sm text-green-400">{toast}</p>
        </div>
      )}

      {/* เพิ่มใหม่ */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.slug.trim() || !form.label.trim()) return;
          run(() => adminPost("/categories", { slug: form.slug.trim(), label: form.label.trim() }), "เพิ่มหมวดหมู่แล้ว");
          setForm({ slug: "", label: "" });
        }}
        className="mb-5 flex flex-col gap-2 rounded-xl p-4 sm:flex-row"
        style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}
      >
        <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="ชื่อที่แสดง เช่น ถาม-ตอบ" className="flex-1 rounded-lg px-3 py-2 text-sm lms-input" />
        <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="slug เช่น question" className="flex-1 rounded-lg px-3 py-2 text-sm lms-input" />
        <button type="submit" disabled={!form.slug.trim() || !form.label.trim()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--lms-accent)" }}>
          เพิ่ม
        </button>
      </form>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ยังไม่มีหมวดหมู่</p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", opacity: c.active ? 1 : 0.55 }}>
              <input
                defaultValue={c.label}
                onBlur={(e) => e.target.value !== c.label && e.target.value.trim() &&
                  run(() => adminPut(`/categories/${c.id}`, { label: e.target.value.trim() }), "บันทึกชื่อแล้ว")}
                className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm lms-input"
              />
              <code className="shrink-0 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{c.slug}</code>
              <span className="shrink-0 text-[11px]" style={{ color: "var(--lms-text-muted)" }}>{c.postCount} โพสต์</span>

              <input type="number" defaultValue={c.order} title="ลำดับ"
                onBlur={(e) => Number(e.target.value) !== c.order &&
                  run(() => adminPut(`/categories/${c.id}`, { order: Number(e.target.value) }), "จัดลำดับแล้ว")}
                className="w-16 shrink-0 rounded-lg px-2 py-1.5 text-center text-xs lms-input" />

              <button onClick={() => run(() => adminPut(`/categories/${c.id}`, { active: !c.active }),
                c.active ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว")}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs transition hover:opacity-80"
                style={{ border: "1px solid var(--lms-border)", color: "var(--lms-text-secondary)" }}>
                {c.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>

              <button
                onClick={() => confirm(`ลบหมวดหมู่ "${c.label}"?`) && run(() => adminDelete(`/categories/${c.id}`), "ลบแล้ว")}
                className="shrink-0 text-xs hover:underline" style={{ color: "var(--lms-red)" }}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
        หมวดที่มีโพสต์อยู่จะลบไม่ได้ — ใช้ &quot;ปิดใช้งาน&quot; แทน โพสต์เดิมยังอยู่แต่จะไม่มีให้เลือกตอนโพสต์ใหม่
        · slug แก้ไม่ได้เพราะโพสต์อ้างอิงค่านี้อยู่
      </p>
    </div>
  );
}
