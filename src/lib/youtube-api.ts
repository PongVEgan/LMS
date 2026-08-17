"use client";

import { useEffect, useState } from "react";

/** ตัวโหลด IFrame Player API ใช้ร่วมกันระหว่างเครื่องเล่นจริงกับตัวอ่านความยาวในหน้าแอดมิน */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type YTPlayer = any;

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; ENDED: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** โหลดสคริปต์ YouTube ครั้งเดียวต่อหน้า แล้ว resolve เมื่อ API พร้อมใช้ */
export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * อ่านความยาวคลิปจากลิงก์ YouTube โดยไม่ต้องใช้ API key
 * สร้าง player ซ่อนไว้นอกจอ พออ่านค่าได้ก็ทำลายทิ้งทันที
 */
export function useYouTubeDuration(videoId: string | null) {
  // ผูกผลลัพธ์กับ videoId ไว้ด้วยกัน จะได้ไม่ต้อง setState เคลียร์ค่าตอนเปลี่ยนคลิป
  const [result, setResult] = useState<{ id: string; duration: number | null } | null>(null);

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;
    let player: YTPlayer = null;

    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px";
    document.body.appendChild(holder);

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      player = new window.YT.Player(holder, {
        videoId,
        events: {
          onReady: () => {
            if (cancelled) return;
            const d = Math.round(player?.getDuration?.() || 0);
            setResult({ id: videoId, duration: d > 0 ? d : null });
          },
          // คลิปส่วนตัว/ลบไปแล้ว — จบด้วยค่าว่าง ไม่ค้างสถานะกำลังโหลด
          onError: () => !cancelled && setResult({ id: videoId, duration: null }),
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy?.();
      holder.remove();
    };
  }, [videoId]);

  const matched = result?.id === videoId ? result : null;
  return {
    duration: matched?.duration ?? null,
    loading: !!videoId && !matched,
  };
}
