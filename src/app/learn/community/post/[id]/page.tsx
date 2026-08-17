"use client";

import { learnFetch, learnPost, learnDelete , LMS_API } from "@/lib/learn-fetch";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";


const LEVEL_COLORS: Record<number, string> = {
  1: "bg-zinc-700 text-zinc-300", 2: "bg-zinc-700 text-zinc-300",
  3: "bg-blue-500/20 text-blue-300", 4: "bg-blue-500/20 text-blue-300",
  5: "bg-purple-500/20 text-purple-300", 6: "bg-purple-500/20 text-purple-300",
  7: "bg-yellow-500/20 text-yellow-300", 8: "bg-yellow-500/20 text-yellow-300",
  9: "bg-gradient-to-r from-yellow-400 to-pink-500 text-white",
};
function LevelBadge({ level }: { level: number }) {
  return <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_COLORS[level] || LEVEL_COLORS[1]}`}>Lv.{level}</span>;
}
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อสักครู่"; if (m < 60) return `${m} น.`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชม.`;
  return `${Math.floor(h / 24)} วัน`;
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const email = session?.user?.email || "";
  const headers = { "x-user-email": email };

  const loadPost = () => {
    if (!email) return;
    learnFetch(`/community/posts/${id}`)
      .then(r => r.json()).then(setPost).catch(e => console.error("API error:", e)).finally(() => setLoading(false));
  };

  useEffect(() => { if (status !== "loading") loadPost(); }, [id, email, status]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    setCommenting(true);
    try {
      const res = await learnPost(`/community/posts/${id}/comments`, { content: comment });
      if (!res.ok) throw new Error();
      setComment(""); loadPost();
    } catch { alert("ส่งความคิดเห็นไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setCommenting(false); }
  };

  const handleReply = (authorName: string) => {
    setComment(`@${authorName} `);
    commentRef.current?.focus();
  };

  const handleLikePost = async () => {
    try {
      await learnPost(`/community/posts/${id}/like`, {});
      loadPost();
    } catch { console.error("Like failed"); }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      await learnPost(`/community/comments/${commentId}/like`, {});
      loadPost();
    } catch { console.error("Comment like failed"); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} /></div>;
  if (!post) return <div className="py-10 text-center" style={{ color: "var(--lms-text-muted)" }}>ไม่พบโพสต์</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
      <Link href="/learn/community" className="mb-4 inline-flex items-center gap-1 text-sm transition hover:opacity-70" style={{ color: "var(--lms-text-muted)" }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        กลับ
      </Link>

      {/* Post */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)", boxShadow: "var(--lms-shadow)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
            {(post.author.name || post.author.email)[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--lms-text)" }}>{post.author.name || post.author.email.split("@")[0]}</span>
              <LevelBadge level={post.author.level} />
            </div>
            <div className="text-xs" style={{ color: "var(--lms-text-faint)" }}>
              {post.author.businessName && <>{post.author.businessName} · </>}{timeAgo(post.createdAt)}
            </div>
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap mb-4" style={{ color: "var(--lms-text)" }}>{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="" className="rounded-lg w-full mb-4" />}

        <button onClick={handleLikePost} className="flex items-center gap-1 text-xs transition hover:opacity-80" style={{ color: post.isLiked ? "var(--lms-red)" : "var(--lms-text-muted)" }}>
          <svg className="h-4 w-4" fill={post.isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.likeCount > 0 && <span>{post.likeCount} ถูกใจ</span>}
        </button>
      </div>

      {/* Comments */}
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--lms-text-secondary)" }}>ความคิดเห็น ({post.comments?.length || 0})</h3>

      <div className="space-y-3 mb-6">
        {post.comments?.map((c: any) => (
          <div key={c.id} className="rounded-lg p-3" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: "var(--lms-accent-bg)", color: "var(--lms-accent-text)" }}>
                {(c.author.name || c.author.email)[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--lms-text)" }}>{c.author.name || c.author.email.split("@")[0]}</span>
              <LevelBadge level={c.author.level} />
              <span className="text-[10px]" style={{ color: "var(--lms-text-faint)" }}>{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap ml-9" style={{ color: "var(--lms-text)" }}>{c.content}</p>
            <div className="flex items-center gap-3 ml-9 mt-1">
              <button onClick={() => handleLikeComment(c.id)} className="flex items-center gap-1 text-[11px] transition hover:opacity-80" style={{ color: c.isLiked ? "var(--lms-red)" : "var(--lms-text-faint)" }}>
                <svg className="h-3.5 w-3.5" fill={c.isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                {c.likeCount > 0 && <span>{c.likeCount}</span>}
              </button>
              <button onClick={() => handleReply(c.author.name || c.author.email.split("@")[0])} className="text-[11px] transition hover:opacity-80" style={{ color: "var(--lms-text-faint)" }}>
                ตอบกลับ
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Compose Comment */}
      <div className="rounded-xl p-4" style={{ background: "var(--lms-bg-card)", border: "1px solid var(--lms-border)" }}>
        <textarea ref={commentRef} value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="เขียนความคิดเห็น..."
          className="w-full rounded-lg px-4 py-3 text-sm resize-none lms-input" />
        <div className="flex justify-end mt-2">
          <button onClick={handleComment} disabled={!comment.trim() || commenting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" style={{ background: "var(--lms-accent)" }}>
            {commenting ? "..." : "ตอบกลับ"}
          </button>
        </div>
      </div>
    </div>
  );
}
