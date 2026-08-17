"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { adminGet, adminJson, adminPut } from "@/lib/admin-fetch";

interface Order {
  id: string; amount: number; method: string; status: string;
  reference: string; note: string | null; createdAt: string; paidAt: string | null;
  courseTitle: string; email: string; name: string | null;
}

const FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "awaiting_review", label: "รอตรวจสอบ" },
  { value: "paid", label: "จ่ายแล้ว" },
  { value: "pending", label: "ยังไม่จ่าย" },
  { value: "failed", label: "ล้มเหลว" },
];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: "จ่ายแล้ว", color: "var(--lms-green)", bg: "rgba(34,197,94,0.12)" },
  awaiting_review: { label: "รอตรวจสอบ", color: "var(--lms-accent-text)", bg: "var(--lms-accent-bg)" },
  pending: { label: "ยังไม่จ่าย", color: "var(--lms-text-muted)", bg: "var(--lms-border)" },
  failed: { label: "ล้มเหลว", color: "var(--lms-red)", bg: "rgba(239,68,68,0.12)" },
};

const METHOD: Record<string, string> = { card: "บัตร", qr: "QR", transfer: "โอน" };

export default function AdminOrdersPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (f: string) => {
    adminGet(`/orders?status=${f}`)
      .then(adminJson<Order[]>)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    load(filter);
  }, [filter, session?.user?.email, status]);

  const decide = async (id: string, next: "paid" | "failed") => {
    setError("");
    try {
      await adminJson(await adminPut(`/orders/${id}/status`, { status: next }));
      load(filter);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl font-bold">คำสั่งซื้อ</h1>
      <p className="mb-4 inline-block rounded px-2 py-0.5 text-[11px]"
        style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
        ระบบชำระเงินจำลอง — ไม่มีเงินจริง
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className="rounded-lg px-3 py-1.5 text-xs transition"
            style={{
              background: filter === f.value ? "var(--lms-accent-bg)" : "var(--lms-bg-card)",
              color: filter === f.value ? "var(--lms-accent-text)" : "var(--lms-text-muted)",
              border: `1px solid ${filter === f.value ? "var(--lms-accent)" : "var(--lms-border)"}`,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>กำลังโหลด...</p>
      ) : orders.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--lms-text-faint)" }}>ไม่มีคำสั่งซื้อ</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? STATUS.pending;
            return (
              <div key={o.id} className="rounded-xl p-4"
                style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{o.courseTitle}</span>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]" style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                      {o.name || o.email.split("@")[0]} · {o.email}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                      {o.reference} · {METHOD[o.method] ?? o.method} · {new Date(o.createdAt).toLocaleString("th-TH")}
                    </p>
                    {o.note && (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--lms-text-muted)" }}>หมายเหตุ: {o.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--lms-accent-text)" }}>
                      ฿{o.amount.toLocaleString()}
                    </span>
                    {o.status === "awaiting_review" && (
                      <div className="flex gap-2">
                        <button onClick={() => decide(o.id, "paid")}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90"
                          style={{ background: "var(--lms-accent)" }}>
                          อนุมัติ
                        </button>
                        <button onClick={() => confirm("ปฏิเสธคำสั่งซื้อนี้?") && decide(o.id, "failed")}
                          className="rounded-lg px-3 py-1.5 text-xs transition hover:opacity-80"
                          style={{ border: "1px solid var(--lms-border)", color: "var(--lms-red)" }}>
                          ปฏิเสธ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
