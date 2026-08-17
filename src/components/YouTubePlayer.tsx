"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtube-api";

/**
 * เครื่องเล่น YouTube ที่รู้ตำแหน่งจริง ผ่าน IFrame Player API
 * - เล่นต่อจากวินาทีที่ค้างไว้ (startAt)
 * - รายงานความคืบหน้าทุก REPORT_EVERY วินาที + ตอนหยุด/ออกจากหน้า
 * - แจ้ง onWatched(percent) ให้หน้าแม่ตัดสินใจว่าจะติ๊กจบไหม
 */

const REPORT_EVERY = 15; // วินาที
const POLL_MS = 1000;

interface Props {
  videoId: string;
  title?: string;
  startAt?: number;
  /** เรียกเมื่อถึงรอบรายงาน — position/percent ปัจจุบัน + วินาทีที่ดูเพิ่มตั้งแต่รายงานครั้งก่อน */
  onProgress: (data: { position: number; percent: number; watched: number; duration: number }) => void;
}

export default function YouTubePlayer({ videoId, title, startAt = 0, onProgress }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer>(null);
  const [ready, setReady] = useState(false);

  // เก็บใน ref เพื่อให้ interval อ่านค่าล่าสุดโดยไม่ต้อง re-create
  const watchedSinceReport = useRef(0);
  const lastReportedAt = useRef(0);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    /** อ่านค่าจาก player แล้วส่งขึ้นไปให้หน้าแม่ */
    const report = () => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const position = Math.floor(p.getCurrentTime() || 0);
      const duration = Math.floor(p.getDuration?.() || 0);
      const percent = duration > 0 ? Math.round((position / duration) * 100) : 0;

      onProgressRef.current({ position, percent, watched: watchedSinceReport.current, duration });
      watchedSinceReport.current = 0;
      lastReportedAt.current = Date.now();
    };

    loadYouTubeApi().then(() => {
      if (cancelled || !holderRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(holderRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, start: Math.max(0, Math.floor(startAt)) },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (e: { data: number }) => {
            // หยุด/จบ = รายงานทันที ไม่ต้องรอครบรอบ
            if (e.data === window.YT?.PlayerState.PAUSED || e.data === window.YT?.PlayerState.ENDED) report();
          },
        },
      });

      // นับเฉพาะตอนเล่นจริง แล้วรายงานเป็นรอบ
      poll = setInterval(() => {
        const p = playerRef.current;
        if (!p?.getPlayerState || p.getPlayerState() !== window.YT?.PlayerState.PLAYING) return;
        watchedSinceReport.current += POLL_MS / 1000;
        if (Date.now() - lastReportedAt.current >= REPORT_EVERY * 1000) report();
      }, POLL_MS);
    });

    // ปิดแท็บ/เปลี่ยนหน้า — ส่งค่าล่าสุดก่อนหาย
    const onHide = () => document.visibilityState === "hidden" && report();
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onHide);
      report();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // สร้าง player ใหม่เมื่อเปลี่ยนคลิปเท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={holderRef} className="h-full w-full" title={title} />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ background: "#000" }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--lms-accent)", borderTopColor: "transparent" }} />
        </div>
      )}
    </div>
  );
}
