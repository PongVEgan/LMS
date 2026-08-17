"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { learnFetch, learnPost } from "@/lib/learn-fetch";

interface CheckoutCourse {
  id: string; slug: string; title: string; description: string | null;
  coverUrl: string | null; price: number; owned: boolean;
}
interface Order {
  id: string; courseSlug: string; amount: number;
  method: string; status: string; reference: string;
}

type Method = "card" | "qr" | "transfer";

const METHODS: { key: Method; label: string; hint: string }[] = [
  { key: "card", label: "บัตรเครดิต/เดบิต", hint: "กรอกเลขบัตรทดสอบ" },
  { key: "qr", label: "QR พร้อมเพย์", hint: "สแกนแล้วกดยืนยัน" },
  { key: "transfer", label: "โอนผ่านบัญชี", hint: "แจ้งโอน รอแอดมินอนุมัติ" },
];

/** QR ปลอมสำหรับเดโม — สร้างลายจาก reference ให้คงที่ ไม่ใช่ QR ที่สแกนได้จริง */
function FakeQR({ seed }: { seed: string }) {
  const size = 21;
  const cells: boolean[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < size * size; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push(((h >>> 16) & 1) === 1);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44" shapeRendering="crispEdges" role="img" aria-label="QR จำลอง">
      <rect width={size} height={size} fill="#fff" />
      {cells.map((on, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        if (isFinder(r, c)) return null;
        return on ? <rect key={i} x={c} y={r} width="1" height="1" fill="#111" /> : null;
      })}
      {[[0, 0], [0, size - 7], [size - 7, 0]].map(([r, c]) => (
        <g key={`${r}-${c}`}>
          <rect x={c} y={r} width="7" height="7" fill="#111" />
          <rect x={c + 1} y={r + 1} width="5" height="5" fill="#fff" />
          <rect x={c + 2} y={r + 2} width="3" height="3" fill="#111" />
        </g>
      ))}
    </svg>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [course, setCourse] = useState<CheckoutCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>("card");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"paid" | "awaiting_review" | null>(null);

  useEffect(() => {
    if (status === "loading" || !session?.user?.email) return;
    learnFetch(`/checkout/courses/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message || "ไม่พบคอร์ส");
        return r.json();
      })
      .then(setCourse)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, session?.user?.email, status]);

  /** สร้างออร์เดอร์ (ถ้ายังไม่มี) แล้วยิงชำระเงิน */
  const handlePay = async () => {
    if (!course) return;
    setPaying(true);
    setError("");
    try {
      let current = order;
      if (!current || current.method !== method) {
        const res = await learnPost("/checkout/orders", { courseSlug: course.slug, method });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "สร้างคำสั่งซื้อไม่สำเร็จ");
        current = data as Order;
        setOrder(current);
      }

      const payRes = await learnPost(`/checkout/orders/${current.id}/pay`, {
        cardNumber: method === "card" ? card.number : undefined,
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.message || "ชำระเงินไม่สำเร็จ");

      setDone(payData.status === "paid" ? "paid" : "awaiting_review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-400">{error || "ไม่พบคอร์สนี้"}</p>
        <Link href="/learn" className="mt-3 inline-block text-sm hover:underline" style={{ color: "var(--lms-accent-text)" }}>
          กลับหน้าคอร์ส
        </Link>
      </div>
    );
  }

  /* ---------- จ่ายเสร็จแล้ว ---------- */
  if (done) {
    const paid = done === "paid";
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: paid ? "rgba(34,197,94,0.12)" : "var(--lms-accent-bg)" }}>
          <svg className="h-7 w-7" style={{ color: paid ? "var(--lms-green)" : "var(--lms-accent-text)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={paid ? "M5 13l4 4L19 7" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"} />
          </svg>
        </div>
        <h1 className="mb-1 text-xl font-bold">{paid ? "ชำระเงินสำเร็จ" : "รับแจ้งการโอนแล้ว"}</h1>
        <p className="mb-1 text-sm" style={{ color: "var(--lms-text-secondary)" }}>
          {paid ? `คุณเข้าเรียน "${course.title}" ได้เลย` : "แอดมินจะตรวจสอบและเปิดสิทธิ์เรียนให้เร็วที่สุด"}
        </p>
        {order && (
          <p className="mb-5 text-xs" style={{ color: "var(--lms-text-faint)" }}>
            เลขที่คำสั่งซื้อ {order.reference}
          </p>
        )}
        <button
          onClick={() => router.push(paid ? `/learn/${course.slug}` : "/learn")}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}>
          {paid ? "เริ่มเรียน" : "กลับหน้าคอร์ส"}
        </button>
      </div>
    );
  }

  /* ---------- มีสิทธิ์เรียนอยู่แล้ว ---------- */
  if (course.owned) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-lg font-bold">คุณมีสิทธิ์เรียนคอร์สนี้อยู่แล้ว</h1>
        <Link href={`/learn/${course.slug}`}
          className="mt-2 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          style={{ background: "var(--lms-accent)" }}>
          เข้าเรียน
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link href="/learn" className="text-xs hover:underline" style={{ color: "var(--lms-text-muted)" }}>
        ← กลับหน้าคอร์ส
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold">ชำระเงิน</h1>
      <p className="mb-5 inline-block rounded px-2 py-0.5 text-[11px]"
        style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
        โหมดทดสอบ — ไม่มีการตัดเงินจริง
      </p>

      {/* สรุปรายการ */}
      <div className="mb-4 flex items-center gap-4 rounded-xl p-4"
        style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-24 shrink-0 rounded-lg" style={{ background: "var(--lms-bg-input)" }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{course.title}</p>
          {course.description && (
            <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--lms-text-muted)" }}>{course.description}</p>
          )}
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: "var(--lms-accent-text)" }}>
          {course.price > 0 ? `฿${course.price.toLocaleString()}` : "ฟรี"}
        </span>
      </div>

      {/* ช่องทางชำระเงิน */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {METHODS.map((m) => (
          <button key={m.key} onClick={() => { setMethod(m.key); setError(""); }}
            className="rounded-xl p-3 text-left transition"
            style={{
              background: method === m.key ? "var(--lms-accent-bg)" : "var(--lms-bg-card)",
              border: `1px solid ${method === m.key ? "var(--lms-accent)" : "var(--lms-border)"}`,
            }}>
            <p className="text-sm font-medium" style={{ color: method === m.key ? "var(--lms-accent-text)" : "var(--lms-text)" }}>
              {m.label}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--lms-text-faint)" }}>{m.hint}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        {method === "card" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>เลขบัตร</label>
              <input value={card.number} inputMode="numeric" placeholder="4242 4242 4242 4242"
                onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อบนบัตร</label>
              <input value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>วันหมดอายุ</label>
                <input value={card.expiry} placeholder="12/28"
                  onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>CVC</label>
                <input value={card.cvc} inputMode="numeric" placeholder="123"
                  onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm lms-input" />
              </div>
            </div>
            <div className="rounded-lg p-3 text-[11px] leading-relaxed"
              style={{ background: "var(--lms-bg-input)", color: "var(--lms-text-muted)" }}>
              <p className="mb-1 font-medium" style={{ color: "var(--lms-text-secondary)" }}>บัตรทดสอบ</p>
              <p>4242 4242 4242 4242 — ชำระสำเร็จ</p>
              <p>4000 0000 0000 0002 — บัตรถูกปฏิเสธ</p>
              <p>4000 0000 0000 0069 — บัตรหมดอายุ</p>
              <p>4000 0000 0000 0127 — CVC ไม่ถูกต้อง</p>
            </div>
          </div>
        )}

        {method === "qr" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl bg-white p-3">
              <FakeQR seed={order?.reference || course.slug} />
            </div>
            <p className="text-center text-xs" style={{ color: "var(--lms-text-muted)" }}>
              QR จำลองสำหรับเดโม สแกนจริงไม่ได้<br />กดปุ่มด้านล่างเพื่อยืนยันว่าชำระแล้ว
            </p>
          </div>
        )}

        {method === "transfer" && (
          <div className="space-y-2 text-sm">
            <p style={{ color: "var(--lms-text-secondary)" }}>โอนเข้าบัญชี (ข้อมูลจำลอง)</p>
            <div className="rounded-lg p-3" style={{ background: "var(--lms-bg-input)" }}>
              <p>ธนาคารตัวอย่าง</p>
              <p className="font-mono text-base">123-4-56789-0</p>
              <p className="text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อบัญชี: บริษัท เดโม จำกัด</p>
            </div>
            <p className="text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
              เมื่อกดแจ้งโอน คำสั่งซื้อจะอยู่สถานะ &quot;รอตรวจสอบ&quot; จนกว่าแอดมินจะอนุมัติในหน้าหลังบ้าน
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button onClick={handlePay} disabled={paying}
        className="w-full rounded-lg py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--lms-accent)" }}>
        {paying
          ? "กำลังดำเนินการ..."
          : method === "transfer"
            ? "แจ้งโอนเงินแล้ว"
            : `ชำระเงิน ฿${course.price.toLocaleString()}`}
      </button>
    </div>
  );
}
