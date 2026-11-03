"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

const ANNOUNCE_CARD_NAMES_KEY = "gacha-announce-card-names";
const ANNOUNCE_CARD_NAMES_EVENT = "gacha-announce-card-names-change";

function subscribeToCardNameAnnouncement(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(ANNOUNCE_CARD_NAMES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ANNOUNCE_CARD_NAMES_EVENT, callback);
  };
}

function getCardNameAnnouncementSetting() {
  return window.localStorage.getItem(ANNOUNCE_CARD_NAMES_KEY) !== "0";
}

type CardView = {
  id: string;
  name: string;
  rarity: string;
  description: string;
  category?: string;
  attack?: number;
  defense?: number;
  manaCost?: number;
  level?: number;
  element?: string;
  icon?: string;
  imageUrl: string | null;
  count?: number;
  dropRate?: number;
};

type BannerView = {
  id: string;
  title: string;
  description: string;
  type: string;
  startsAt: string | null;
  endsAt: string | null;
  cards: { card: CardView; dropRate: number }[];
};

const rarityStyles: Record<string, string> = {
  COMMON: "border-slate-300 bg-slate-100 text-slate-700",
  UNCOMMON: "border-emerald-300 bg-emerald-50 text-emerald-800",
  R: "border-sky-300 bg-sky-50 text-sky-800",
  SR: "border-violet-300 bg-violet-50 text-violet-800",
  SSR: "border-amber-400 bg-amber-50 text-amber-900",
  RARE: "border-sky-300 bg-sky-50 text-sky-800",
  EPIC: "border-violet-300 bg-violet-50 text-violet-800",
  LEGENDARY: "border-amber-400 bg-amber-50 text-amber-900",
  SPECIAL: "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900",
};

const rarityNames: Record<string, string> = {
  COMMON: "Thường",
  UNCOMMON: "Không phổ biến",
  R: "Rare",
  SR: "Super Rare",
  SSR: "Super Special Rare",
  RARE: "Hiếm",
  EPIC: "Sử thi",
  LEGENDARY: "Huyền thoại",
  SPECIAL: "Đặc biệt",
};

export function GachaPageClient({
  banners,
  initialTickets,
  initialCollection,
  initialFeaturedCardId,
  signedIn,
}: {
  banners: BannerView[];
  initialTickets: number;
  initialCollection: CardView[];
  initialFeaturedCardId: string | null;
  signedIn: boolean;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [collection, setCollection] = useState(initialCollection);
  const [featuredCardId, setFeaturedCardId] = useState(initialFeaturedCardId);
  const [bannerId, setBannerId] = useState(banners[0]?.id ?? "");
  const [pulling, setPulling] = useState(false);
  const [revealed, setRevealed] = useState<CardView[]>([]);
  const [revealSkipped, setRevealSkipped] = useState(false);
  const announceCardNames = useSyncExternalStore(
    subscribeToCardNameAnnouncement,
    getCardNameAnnouncementSetting,
    () => true,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const selectedBanner = banners.find((banner) => banner.id === bannerId);

  useEffect(() => {
    if (revealed.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRevealed([]);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [revealed.length]);

  function toggleCardNameAnnouncement() {
    const nextSetting = !announceCardNames;
    try {
      window.localStorage.setItem(ANNOUNCE_CARD_NAMES_KEY, nextSetting ? "1" : "0");
      window.dispatchEvent(new Event(ANNOUNCE_CARD_NAMES_EVENT));
    } catch {
      setError(true);
      setMessage("Không thể lưu cài đặt thông báo tên thẻ.");
    }
  }

  async function pull(quantity: 1 | 10) {
    if (!selectedBanner || tickets < quantity) return;
    setPulling(true);
    setMessage("");
    setError(false);
    setRevealed([]);
    setRevealSkipped(false);
    try {
      const response = await fetch("/api/gacha/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerId: selectedBanner.id, quantity }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể quay thẻ.");
        return;
      }
      setTickets(result.tickets);
      setRevealed(result.cards);
      setCollection((current) => {
        const next = new Map(current.map((card) => [card.id, card]));
        for (const card of result.cards as CardView[]) {
          const existing = next.get(card.id);
          next.set(card.id, { ...card, count: (existing?.count ?? 0) + 1 });
        }
        return [...next.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setPulling(false);
    }
  }

  async function featureCard(cardId: string | null) {
    setMessage("");
    try {
      const response = await fetch("/api/gacha/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể cập nhật thẻ nổi bật.");
        return;
      }
      setError(false);
      setFeaturedCardId(cardId);
      setMessage(cardId ? "Đã đặt thẻ trưng bày trên hồ sơ." : "Đã bỏ thẻ trưng bày.");
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Lượt quay của bạn</p>
            <p className="text-3xl font-bold tabular-nums text-[var(--navy)]">{tickets} <span className="text-base font-medium">🎟</span></p>
          </div>
          {!signedIn && <a href="/login" className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white">Đăng nhập để quay</a>}
        </div>

        {banners.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted)]">Chưa có banner nào đang mở.</p>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap gap-2">
                {banners.map((banner) => (
                  <button key={banner.id} type="button" onClick={() => { setBannerId(banner.id); setRevealed([]); }} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${banner.id === bannerId ? "border-[var(--teal)] bg-[var(--teal)] text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--teal)]"}`}>
                    {banner.title} {banner.type === "LIMITED" ? "⏳" : ""}
                  </button>
                ))}
              </div>
              {selectedBanner && <>
                <div className={`mt-5 rounded-2xl border p-5 sm:p-7 ${selectedBanner.type === "LIMITED" ? "border-amber-300 bg-gradient-to-br from-amber-100 via-rose-50 to-violet-100" : "border-sky-200 bg-gradient-to-br from-sky-100 via-white to-violet-100"}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">{selectedBanner.type === "LIMITED" ? "Banner giới hạn" : "Banner thường"}</p>
                  <h2 className="mt-2 text-3xl font-bold text-[var(--navy)]">{selectedBanner.title}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink)]">{selectedBanner.description || "Thu thập những thẻ yêu thích của bạn."}</p>
                  {selectedBanner.endsAt && <p className="mt-3 text-xs font-medium text-rose-800">Kết thúc: {new Date(selectedBanner.endsAt).toLocaleString("vi-VN")}</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" disabled={!signedIn || pulling || tickets < 1} onClick={() => pull(1)} className="rounded-xl bg-[var(--teal)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{pulling ? "Đang quay..." : "Quay 1 lần · 1 🎟"}</button>
                  <button type="button" disabled={!signedIn || pulling || tickets < 10} onClick={() => pull(10)} className="rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50">{pulling ? "Đang quay..." : "Quay 10 lần · 10 🎟"}</button>
                </div>
                <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={announceCardNames}
                    onChange={toggleCardNameAnnouncement}
                    className="size-4 accent-[var(--teal)]"
                  />
                  Thông báo tên thẻ sau khi quay
                </label>
              </>}
            </div>
            <aside className="border-t border-[var(--line)] bg-[var(--navy)]/[0.025] p-5 lg:border-l lg:border-t-0">
              <h3 className="font-semibold text-[var(--navy)]">Tỉ lệ trong banner</h3>
              <div className="mt-3 space-y-2">
                {selectedBanner?.cards.map(({ card, dropRate }) => (
                  <div key={card.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <span className="min-w-0 truncate text-sm">{card.name} <span className="text-xs text-[var(--muted)]">{card.category === "BATTLE" ? "· Battle Ready · " : "· "}{rarityNames[card.rarity] ?? card.rarity}</span></span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{dropRate}%</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </section>

      {pulling && (
        <section aria-live="polite" className="gacha-pull-stage relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-8 text-center sm:p-12">
          <div className="gacha-pull-aura" aria-hidden="true" />
          <div className="relative mx-auto flex size-24 items-center justify-center rounded-full border-2 border-[var(--teal)]/70 bg-[var(--teal)]/10 shadow-[0_0_40px_color-mix(in_srgb,var(--teal)_35%,transparent)]">
            <span className="gacha-pull-sigil text-5xl" aria-hidden="true">✦</span>
          </div>
          <p className="relative mt-5 text-lg font-bold text-[var(--navy)]">Đang mở thẻ...</p>
          <p className="relative mt-1 text-sm text-[var(--muted)]">Vận may đang đến!</p>
        </section>
      )}

      {message && <p role={error ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}

      {revealed.length > 0 && (
        <div
          className="gacha-reveal-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 sm:p-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRevealed([]);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gacha-reveal-title"
            className="gacha-reveal-dialog my-auto max-h-full w-full max-w-5xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-2xl sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="gacha-reveal-title" className="text-xl font-bold text-[var(--navy)]">Thẻ vừa nhận!</h2>
              <div className="flex items-center gap-2">
                {!revealSkipped && (
                  <button type="button" onClick={() => setRevealSkipped(true)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--teal)]">
                    Bỏ qua hiệu ứng
                  </button>
                )}
                <button type="button" autoFocus onClick={() => setRevealed([])} aria-label="Đóng kết quả quay" className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--teal)]">
                  Đóng
                </button>
              </div>
            </div>
            {announceCardNames && (
              <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-[var(--teal)]/10 px-4 py-3 text-sm font-medium text-[var(--ink)]">
                Bạn nhận được: {revealed.map((card) => card.name).join(", ")}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {revealed.map((card, index) => (
                <CardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  revealIndex={revealSkipped ? undefined : index}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--navy)]">Bộ sưu tập</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Thẻ Battle Ready có thể đưa vào bộ bài để đấu PvP.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {collection.some((card) => card.category === "BATTLE") && <Link href="/battle/deck" className="text-sm font-bold text-[var(--teal)] hover:underline">Xây bộ bài PvP →</Link>}
            {featuredCardId && <button type="button" onClick={() => featureCard(null)} className="text-sm font-medium text-[var(--teal)] hover:underline">Bỏ thẻ nổi bật</button>}
          </div>
        </div>
        {collection.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">Bạn chưa có thẻ nào. Hoàn thành bài tập hoặc quay banner để bắt đầu sưu tập.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {collection.map((card) => (
              <div key={card.id} className="space-y-2">
                <CardTile card={card} />
                {card.category !== "BATTLE" && (
                  <button type="button" onClick={() => featureCard(card.id)} className={`w-full rounded-lg px-2 py-2 text-xs font-semibold ${featuredCardId === card.id ? "bg-[var(--teal)] text-white" : "border border-[var(--line)] text-[var(--ink)] hover:border-[var(--teal)]"}`}>
                    {featuredCardId === card.id ? "Đang trưng bày" : "Trưng bày trên hồ sơ"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardTile({ card, revealIndex }: { card: CardView; revealIndex?: number }) {
  const tile = (
    <article className={`overflow-hidden rounded-xl border-2 ${rarityStyles[card.rarity] ?? rarityStyles.COMMON} ${revealIndex !== undefined && ["EPIC", "LEGENDARY", "SPECIAL"].includes(card.rarity) ? "gacha-card-rare" : ""}`}>
      <div className="relative aspect-[3/4] bg-[var(--navy)]/5">
        {card.imageUrl ? (
          <Image src={card.imageUrl} alt={card.name} fill unoptimized sizes="(max-width: 640px) 45vw, 180px" className="object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-5xl" aria-label={card.name}>{card.icon || "🃏"}</div>
        )}
        {card.count && card.count > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-bold text-white">×{card.count}</span>}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-bold">{card.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide">{rarityNames[card.rarity] ?? card.rarity}</p>
        {card.category === "BATTLE" && (
          <p className="mt-1 text-[10px] font-bold">
            PvP · ATK {card.attack ?? 0} / DEF {card.defense ?? 0} · 💎 {card.manaCost ?? 0}
          </p>
        )}
        {card.description && <p className="mt-1 line-clamp-2 text-xs opacity-80">{card.description}</p>}
      </div>
    </article>
  );

  if (revealIndex === undefined) return tile;

  return (
    <div
      className="gacha-card-perspective"
      style={{ "--gacha-reveal-delay": `${Math.min(revealIndex, 9) * 100}ms` } as React.CSSProperties}
    >
      <div className="gacha-card-flip">
        <div className="gacha-card-back" aria-hidden="true">
          <span className="text-5xl text-amber-200">✦</span>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/75">A2OJ</span>
        </div>
        {tile}
      </div>
    </div>
  );
}
