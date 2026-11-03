"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function BattleLobbyPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  function enterRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = roomCode.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,48}$/.test(normalizedCode)) {
      setError("Mã phòng cần từ 3–48 ký tự, chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.");
      return;
    }

    router.push(`/battle/${encodeURIComponent(normalizedCode)}`);
  }

  function createRoom() {
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toLowerCase();
    router.push(`/battle/${code}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal)]">A2OJ · Giải trí</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--navy)]">Đấu bài PvP</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Tạo một phòng rồi chia sẻ mã cho đối thủ, hoặc nhập mã phòng bạn bè gửi để tham gia.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-cyan-400/25 bg-slate-950 p-5 text-slate-100 shadow-lg shadow-cyan-950/10">
          <div className="text-3xl" aria-hidden="true">⚔️</div>
          <h2 className="mt-3 text-lg font-bold">Tạo phòng mới</h2>
          <p className="mt-1 min-h-10 text-sm leading-5 text-slate-400">
            Bắt đầu một bàn đấu riêng và gửi đường dẫn phòng cho đối thủ.
          </p>
          <button
            type="button"
            onClick={createRoom}
            className="mt-4 w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            Tạo phòng
          </button>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="text-3xl" aria-hidden="true">🎴</div>
          <h2 className="mt-3 text-lg font-bold text-[var(--navy)]">Tham gia phòng</h2>
          <p className="mt-1 min-h-10 text-sm leading-5 text-[var(--muted)]">
            Nhập mã phòng được chia sẻ để vào cùng bàn đấu.
          </p>
          <form onSubmit={enterRoom} className="mt-4 space-y-2">
            <label htmlFor="battle-room-code" className="sr-only">Mã phòng</label>
            <input
              id="battle-room-code"
              value={roomCode}
              onChange={(event) => {
                setRoomCode(event.target.value);
                setError("");
              }}
              maxLength={48}
              placeholder="Ví dụ: a2oj123456"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--teal)] px-4 py-2.5 text-sm font-bold text-[var(--teal)] transition hover:bg-[var(--teal)]/10"
            >
              Vào phòng
            </button>
          </form>
        </article>
      </section>

      <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-[var(--muted)]">
        Hai người chơi cần mở cùng một mã phòng. Để đồng bộ online, hệ thống cần cấu hình Supabase Realtime.
      </p>
    </div>
  );
}
