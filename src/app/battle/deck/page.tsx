"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MAX_BATTLE_DECK_SIZE, MIN_BATTLE_DECK_SIZE } from "@/lib/battle-deck";

type OwnedBattleCard = {
  id: string;
  name: string;
  rarity: string;
  description: string;
  battleType: string;
  attack: number;
  defense: number;
  manaCost: number;
  level: number;
  element: string;
  icon: string;
  imageUrl: string | null;
  ownedCount: number;
};

type DeckEntry = { cardId: string; count: number };

export default function BattleDeckPage() {
  const [cards, setCards] = useState<OwnedBattleCard[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const total = useMemo(() => Object.values(counts).reduce((sum, count) => sum + count, 0), [counts]);

  useEffect(() => {
    let active = true;
    fetch("/api/battle/deck")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Không tải được bộ sưu tập Battle.");
        return result as { cards: OwnedBattleCard[]; deck: DeckEntry[] };
      })
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
        setCounts(Object.fromEntries(result.deck.map(({ cardId, count }) => [cardId, count])));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được bộ sưu tập Battle.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function changeCount(card: OwnedBattleCard, delta: number) {
    setCounts((current) => {
      const nextCount = (current[card.id] ?? 0) + delta;
      if (nextCount < 0 || nextCount > card.ownedCount) return current;
      const next = { ...current };
      if (nextCount === 0) delete next[card.id];
      else next[card.id] = nextCount;
      return next;
    });
    setMessage("");
  }

  async function saveDeck() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/battle/deck", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: Object.entries(counts).map(([cardId, count]) => ({ cardId, count })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không lưu được bộ bài.");
      setMessage("Đã lưu bộ bài PvP.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 p-4 text-slate-100 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/battle" className="text-sm font-semibold text-cyan-300 hover:underline">← Quay lại PvP</Link>
          <h1 className="mt-3 text-2xl font-black">Bộ bài PvP</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Thẻ Quái vật, Phép và Bẫy nhận từ Gacha có thể dùng trong PvP. Chọn từ {MIN_BATTLE_DECK_SIZE} đến {MAX_BATTLE_DECK_SIZE} lá; số bản sao không vượt quá số đang sở hữu.
          </p>
        </div>
        <Link href="/gacha" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-300/10">
          🎟 Đi Gacha
        </Link>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
        <p className="text-sm font-bold">Đã chọn: <span className={total >= MIN_BATTLE_DECK_SIZE && total <= MAX_BATTLE_DECK_SIZE ? "text-emerald-300" : "text-amber-200"}>{total}/{MAX_BATTLE_DECK_SIZE}</span></p>
        <button
          type="button"
          onClick={saveDeck}
          disabled={loading || saving || total < MIN_BATTLE_DECK_SIZE || total > MAX_BATTLE_DECK_SIZE}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Đang lưu..." : "Lưu bộ bài"}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error} {error.includes("đăng nhập") && <Link href="/login" className="font-bold underline">Đăng nhập</Link>}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Đang tải bộ sưu tập...</p>
      ) : cards.length === 0 ? (
        <section className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-lg font-bold">Bạn chưa có thẻ chiến đấu</p>
          <p className="mt-2 text-sm text-slate-400">Quay banner có thẻ PvP để bắt đầu xây dựng bộ bài.</p>
          <Link href="/gacha" className="mt-4 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">Mở Gacha</Link>
        </section>
      ) : (
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const count = counts[card.id] ?? 0;
            return (
              <article key={card.id} className={`flex gap-3 rounded-xl border p-3 ${count > 0 ? "border-cyan-300/40 bg-cyan-300/5" : "border-slate-800 bg-slate-900/60"}`}>
                <div
                  className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-3xl"
                >
                  {card.imageUrl && (
                    <Image
                      src={card.imageUrl}
                      alt={card.name}
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                  <span className={`absolute ${card.imageUrl ? "left-1 top-1 text-sm" : "inset-0 grid place-items-center"} rounded-full bg-slate-950/65 px-1`} aria-hidden="true">{card.icon || "🃏"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold">{card.name}</h2>
                      <p className="text-[10px] uppercase tracking-wide text-cyan-200/70">{card.rarity} · {card.battleType === "SPELL" ? "Phép" : card.battleType === "TRAP" ? "Bẫy" : `Quái vật · Cấp ${card.level}`}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">Sở hữu ×{card.ownedCount}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-rose-200">{card.battleType === "MONSTER" ? `ATK ${card.attack} · DEF ${card.defense} · ` : ""}💎 {card.manaCost}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{card.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => changeCount(card, -1)} disabled={count === 0} aria-label={`Bỏ ${card.name} khỏi bộ bài`} className="grid size-7 place-items-center rounded-md border border-slate-700 disabled:opacity-30">−</button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{count}</span>
                    <button type="button" onClick={() => changeCount(card, 1)} disabled={count >= card.ownedCount || total >= MAX_BATTLE_DECK_SIZE} aria-label={`Thêm ${card.name} vào bộ bài`} className="grid size-7 place-items-center rounded-md border border-slate-700 disabled:opacity-30">+</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {total >= MIN_BATTLE_DECK_SIZE && total <= MAX_BATTLE_DECK_SIZE && (
        <Link href="/battle" className="mt-5 inline-flex rounded-lg border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-300/10">Vào sảnh đấu →</Link>
      )}
    </main>
  );
}
