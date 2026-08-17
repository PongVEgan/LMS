"use client";

import { learnFetch, learnPost, learnPut, LMS_API } from "@/lib/learn-fetch";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";


interface CourseInfo {
  title: string;
  slug: string;
  customerCode: string;
  status: string;
  enrolledAt: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

interface Profile {
  email: string;
  displayName: string | null;
  phone: string | null;
  lineId: string | null;
  hasPassword: boolean;
  createdAt: string;
  courses: CourseInfo[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

interface Order {
  id: string; courseTitle: string; amount: number;
  status: string; reference: string; createdAt: string;
}

const ORDER_STATUS: Record<string, string> = {
  paid: "จ่ายแล้ว",
  awaiting_review: "รอตรวจสอบ",
  pending: "ยังไม่จ่าย",
  failed: "ล้มเหลว",
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [bio, setBio] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [province, setProvince] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  const show = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    if (!session?.user?.email) return;
    learnFetch(`/auth/profile?email=${encodeURIComponent(session.user.email)}`)
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setDisplayName(d?.displayName || "");
        setPhone(d?.phone || "");
        setLineId(d?.lineId || "");
        // Load community profile for business fields
        learnFetch("/community/me")
          .then(r => r.ok ? r.json() : null)
          .then(cp => {
            if (cp) {
              setBio(cp.bio || "");
              setBusinessName(cp.businessName || "");
              setIndustry(cp.industry || "");
              setProvince(cp.province || "");
            }
          }).catch(e => console.error("API error:", e));
        learnFetch("/checkout/orders")
          .then(r => r.ok ? r.json() : [])
          .then(d => setOrders(Array.isArray(d) ? d : []))
          .catch(e => console.error("API error:", e));
      })
      .catch(e => console.error("API error:", e))
      .finally(() => setLoading(false));
  }, [session?.user?.email]);

  const handleSaveName = async () => {
    if (!session?.user?.email) return;
    setSaving(true); setError("");
    try {
      const res = await learnPost("/auth/update-profile", { email: session.user.email, displayName, phone, lineId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "บันทึกไม่สำเร็จ");
        return;
      }
      await learnPut("/community/me", { displayName, bio, businessName, industry, province });
      show("บันทึกแล้ว");
    } catch { setError("ไม่สามารถเชื่อมต่อได้"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;
    setError("");
    if (newPassword !== confirmPassword) { setError("รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    if (newPassword.length < 6) { setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setSaving(true);
    try {
      const res = await learnPost("/auth/update-profile", { email: session.user.email, currentPassword, newPassword });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      show("เปลี่ยนรหัสผ่านสำเร็จ");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch { setError("ไม่สามารถเชื่อมต่อได้"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-6 sm:py-10">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg px-4 py-2 text-sm" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--lms-green)" }}>
          {toast}
        </div>
      )}

      <Link href="/learn" className="mb-4 inline-flex items-center gap-1 text-sm transition hover:opacity-70" style={{ color: "var(--lms-text-muted)" }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        กลับหน้าหลัก
      </Link>
      <h1 className="mb-6 text-xl font-bold">โปรไฟล์</h1>

      {/* User Card */}
      <div className="mb-6 rounded-xl p-5" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
            {(profile?.displayName || profile?.email || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold" style={{ color: "var(--lms-text)" }}>
              {profile?.displayName || profile?.email?.split("@")[0]}
            </h2>
            <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>{profile?.email}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: "var(--lms-text-faint)" }}>
              {profile?.createdAt && <span>สมัครเมื่อ {formatDate(profile.createdAt)}</span>}
              <span>{profile?.hasPassword ? "อีเมล + รหัสผ่าน" : "ยังไม่ได้ตั้งรหัสผ่าน"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div className="mb-6 rounded-xl p-5" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
        <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>ข้อมูลทั่วไป</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อที่แสดง</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>เบอร์โทร</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0812345678" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>Line ID</label>
            <input type="text" value={lineId} onChange={e => setLineId(e.target.value)} placeholder="@lineid" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ชื่อธุรกิจ</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="เช่น บริษัท สมชาย จำกัด" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>อุตสาหกรรม</label>
              <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="เช่น ค้าปลีก" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>จังหวัด</label>
              <input type="text" value={province} onChange={e => setProvince(e.target.value)} placeholder="เช่น กรุงเทพ" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>แนะนำตัว</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="เกี่ยวกับตัวคุณสั้นๆ..." className="w-full rounded-lg px-4 py-2.5 text-sm lms-input resize-none" />
          </div>
          <button onClick={handleSaveName} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90"
            style={{ background: "var(--lms-accent)" }}>
            {saving ? "..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* Courses */}
      {profile?.courses && profile.courses.length > 0 && (
        <div className="mb-6 rounded-xl p-5" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
          <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>คอร์สของฉัน</h3>
          <div className="space-y-3">
            {profile.courses.map((c) => (
              <Link key={c.customerCode} href={`/learn/${c.slug}`}
                className="block rounded-lg p-3 transition" style={{ background: "var(--lms-bg)", border: "1px solid var(--lms-border)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--lms-text)" }}>{c.title}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--lms-text-faint)" }}>{c.customerCode}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--lms-text-muted)" }}>
                  <span>{c.completedLessons}/{c.totalLessons} บท</span>
                  <span style={{ color: "var(--lms-accent-text)" }}>{c.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--lms-border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.percent}%`, background: "var(--lms-accent)" }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Change Password */}
      {profile?.hasPassword && (
        <div className="rounded-xl p-5" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
          <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>เปลี่ยนรหัสผ่าน</h3>
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>รหัสผ่านปัจจุบัน</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>รหัสผ่านใหม่</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="อย่างน้อย 6 ตัวอักษร" className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs" style={{ color: "var(--lms-text-muted)" }}>ยืนยันรหัสผ่านใหม่</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full rounded-lg px-4 py-2.5 text-sm lms-input" />
            </div>
            <button type="submit" disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--lms-accent)" }}>
              {saving ? "..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </div>
      )}

      {/* ประวัติการสั่งซื้อ */}
      {orders.length > 0 && (
        <div className="mt-6 rounded-xl p-5" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
          <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--lms-text-secondary)" }}>ประวัติการสั่งซื้อ</h3>
          <div className="space-y-2">
            {orders.map(o => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--lms-bg-input)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" style={{ color: "var(--lms-text)" }}>{o.courseTitle}</p>
                  <p className="truncate text-[11px]" style={{ color: "var(--lms-text-faint)" }}>
                    {o.reference} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: "var(--lms-text-secondary)" }}>
                  ฿{o.amount.toLocaleString()}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: o.status === "paid" ? "rgba(34,197,94,0.12)" : o.status === "failed" ? "rgba(239,68,68,0.12)" : "var(--lms-accent-bg)",
                    color: o.status === "paid" ? "var(--lms-green)" : o.status === "failed" ? "var(--lms-red)" : "var(--lms-accent-text)",
                  }}>
                  {ORDER_STATUS[o.status] ?? o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!profile?.hasPassword && (
        <div className="mt-6 rounded-xl p-5 text-center" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
          <p className="text-sm" style={{ color: "var(--lms-text-muted)" }}>บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน</p>
          <p className="mt-1 text-xs" style={{ color: "var(--lms-text-faint)" }}>ตั้งรหัสผ่านผ่านหน้าลืมรหัสผ่านเพื่อเข้าสู่ระบบด้วยอีเมล + รหัสผ่าน</p>
          <Link href="/learn/forgot-password" className="mt-3 inline-block text-sm hover:underline" style={{ color: "var(--lms-accent-text)" }}>
            ตั้งรหัสผ่าน
          </Link>
        </div>
      )}
    </div>
  );
}
