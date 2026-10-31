"use client";

import { useEffect, useState } from "react";

function formatDuration(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSec = Math.abs(totalSeconds);

  const hours = Math.floor(absSec / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);
  const seconds = absSec % 60;

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");

  return `${isNegative ? "-" : ""}${hStr}:${mStr}:${sStr}`;
}

export function ContestCountdownBadge({
  startAt,
  endAt,
}: {
  startAt: string | Date;
  endAt: string | Date;
}) {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // During SSR or initial mount
  if (now === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111927] px-3 py-1 font-mono text-xs font-semibold text-white shadow-inner">
        <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
        --:--:--
      </span>
    );
  }

  const isBefore = now < startMs;
  const isRunning = now >= startMs && now <= endMs;
  const isFinished = now > endMs;

  let timerString = "";
  let dotColor = "bg-emerald-400";
  let statusText = "";

  if (isBefore) {
    // Đang đếm ngược tới lúc bắt đầu
    const secUntilStart = Math.floor((startMs - now) / 1000);
    timerString = formatDuration(secUntilStart);
    dotColor = "bg-amber-400 animate-pulse";
    statusText = "Bắt đầu sau:";
  } else if (isRunning) {
    // Đang diễn ra: đếm ngược tới kết thúc (chuẩn Codeforces/Themis: hiển thị số âm tới kết thúc -hh:mm:ss)
    const secUntilEnd = Math.floor((endMs - now) / 1000);
    timerString = `-${formatDuration(secUntilEnd)}`;
    dotColor = "bg-emerald-400 animate-pulse";
  } else {
    // Đã kết thúc
    timerString = "00:00:00";
    dotColor = "bg-slate-400";
    statusText = "Đã kết thúc";
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-[#0d1522] border border-slate-700/60 px-3.5 py-1 font-mono text-xs font-semibold text-white shadow-sm"
      title={
        isBefore
          ? `Chưa bắt đầu (còn ${timerString})`
          : isRunning
          ? `Đang diễn ra (còn lại ${timerString.replace("-", "")})`
          : "Kỳ thi đã kết thúc"
      }
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`}></span>
      {statusText && <span className="text-[10px] uppercase font-sans text-slate-400 mr-0.5">{statusText}</span>}
      <span className="tracking-wider">{timerString}</span>
    </span>
  );
}
