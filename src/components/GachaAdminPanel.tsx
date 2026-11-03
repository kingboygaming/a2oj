"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GACHA_RARITIES } from "@/lib/gacha";

type CardSummary = {
  id: string;
  slug: string;
  name: string;
  rarity: string;
  specialOnly: boolean;
  category: string;
  battleType: string;
};

type BannerSummary = {
  id: string;
  slug: string;
  title: string;
  type: string;
  active: boolean;
  legendaryPity: number;
  cards: { card: { id: string; name: string; rarity: string; category: string; battleType: string }; dropRate: number }[];
};

type BannerCardDraft = { cardId: string; dropRate: number };

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

function getCardTypeLabel(card: { category: string; battleType?: string }) {
  if (card.category !== "BATTLE") return "Trưng bày";
  if (card.battleType === "SPELL") return "Phép";
  if (card.battleType === "TRAP") return "Bẫy";
  return "Quái vật";
}

export function GachaAdminPanel({
  banners,
  specialCards,
  cards,
}: {
  banners: BannerSummary[];
  specialCards: { id: string; name: string; rarity: string }[];
  cards: CardSummary[];
}) {
  const router = useRouter();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [dropRates, setDropRates] = useState<Record<string, number>>({});
  const [cardToAdd, setCardToAdd] = useState("");
  const [bannerType, setBannerType] = useState("NORMAL");
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerCardDrafts, setBannerCardDrafts] = useState<Record<string, BannerCardDraft[]>>({});
  const [bannerPityDrafts, setBannerPityDrafts] = useState<Record<string, number>>({});
  const [bannerCardToAdd, setBannerCardToAdd] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerDeletingId, setBannerDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cardPending, setCardPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const totalRate = selectedCardIds.reduce((sum, id) => sum + (Number(dropRates[id]) || 0), 0);

  async function submitBanner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: String(form.get("slug")),
      title: String(form.get("title")),
      description: String(form.get("description") ?? ""),
      type: String(form.get("type")),
      legendaryPity: Number(form.get("legendaryPity") ?? 0),
      startsAt: form.get("startsAt") ? new Date(String(form.get("startsAt"))).toISOString() : null,
      endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))).toISOString() : null,
      cards: selectedCardIds.map((cardId) => ({ cardId, dropRate: Number(dropRates[cardId]) })),
    };
    try {
      const response = await fetch("/api/admin/gacha/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể tạo banner.");
        return;
      }
      setError(false);
      setMessage("Đã tạo banner và bộ thẻ.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setPending(false);
    }
  }

  async function submitCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCardPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    try {
      const response = await fetch("/api/admin/gacha/cards", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể tạo thẻ.");
        return;
      }
      setError(false);
      setMessage(form.get("specialOnly") === "true" ? "Đã tạo thẻ đặc biệt." : "Đã tạo thẻ banner.");
      formElement.reset();
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setCardPending(false);
    }
  }

  async function setBannerActive(id: string, active: boolean) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/gacha/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể cập nhật banner.");
        return;
      }
      setError(false);
      setMessage("");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    }
  }

  async function saveBannerPity(bannerId: string, legendaryPity: number) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/gacha/banners/${bannerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legendaryPity }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể cập nhật pity banner.");
        return;
      }
      setError(false);
      setMessage("Đã cập nhật pity Huyền thoại.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    }
  }

  function startEditingBanner(banner: BannerSummary) {
    setEditingBannerId(banner.id);
    setBannerCardToAdd("");
    setBannerCardDrafts((current) => ({
      ...current,
      [banner.id]: banner.cards.map(({ card, dropRate }) => ({ cardId: card.id, dropRate })),
    }));
  }

  async function saveBannerCards(bannerId: string) {
    const bannerCards = bannerCardDrafts[bannerId] ?? [];
    const total = bannerCards.reduce((sum, item) => sum + (Number(item.dropRate) || 0), 0);
    if (Math.round(total * 10_000) !== 1_000_000) {
      setError(true);
      setMessage("Tổng tỉ lệ các thẻ trong banner phải bằng đúng 100%.");
      return;
    }

    setBannerSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/gacha/banners/${bannerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: bannerCards }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể cập nhật thẻ trong banner.");
        return;
      }
      setError(false);
      setMessage("Đã cập nhật thẻ và tỉ lệ banner.");
      setEditingBannerId(null);
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setBannerSaving(false);
    }
  }

  async function deleteBanner(banner: BannerSummary) {
    if (!window.confirm(`Xóa banner "${banner.title}"? Banner có lịch sử quay sẽ không thể xóa; bạn có thể tắt banner để ẩn nó.`)) return;
    setBannerDeletingId(banner.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/gacha/banners/${banner.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể xóa banner.");
        return;
      }
      setError(false);
      setMessage(`Đã xóa banner "${banner.title}".`);
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setBannerDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submitBanner} className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Tạo banner</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Tổng tỉ lệ phải bằng 100%. Mỗi thẻ hỗ trợ tối đa 4 chữ số thập phân.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên banner"><input name="title" required maxLength={100} className={inputClass} /></Field>
          <Field label="Slug"><input name="slug" required minLength={2} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} title="Slug cần ít nhất 2 ký tự, chỉ gồm chữ thường, số và dấu gạch ngang." className={inputClass} /></Field>
          <Field label="Loại banner">
            <select name="type" value={bannerType} onChange={(event) => setBannerType(event.target.value)} className={inputClass}>
              <option value="NORMAL">Thường</option>
              <option value="LIMITED">Giới hạn</option>
            </select>
          </Field>
          <Field label="Mô tả"><input name="description" maxLength={500} className={inputClass} /></Field>
          <Field label="Pity Huyền thoại (0 = tắt)">
            <input name="legendaryPity" type="number" min={0} max={10000} step={1} defaultValue={0} className={inputClass} />
          </Field>
          <p className="self-end text-xs text-[var(--muted)]">Đặt số lượt tối đa chưa ra Huyền thoại; lượt thứ N được bảo đảm ra thẻ Huyền thoại. Banner phải có ít nhất một thẻ Huyền thoại.</p>
          <Field label={`Bắt đầu${bannerType === "LIMITED" ? "" : " (tùy chọn)"}`}><input name="startsAt" required={bannerType === "LIMITED"} type="datetime-local" className={inputClass} /></Field>
          <Field label={`Kết thúc${bannerType === "LIMITED" ? "" : " (tùy chọn)"}`}><input name="endsAt" required={bannerType === "LIMITED"} type="datetime-local" className={inputClass} /></Field>
        </div>

        <section className="space-y-3 rounded-lg border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[var(--navy)]">Thẻ trong banner</h3>
            <span className={`text-sm font-semibold ${Math.round(totalRate * 10_000) === 1_000_000 ? "text-emerald-700" : "text-rose-700"}`}>
              Tổng: {totalRate.toFixed(4)}%
            </span>
          </div>
          {cards.filter((card) => card.category === "BATTLE" || !card.specialOnly).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Tạo thẻ trưng bày hoặc thẻ PvP (Quái vật, Phép, Bẫy) trong Card Studio trước.</p>
          ) : (
            <div className="space-y-2">
              {selectedCardIds.map((id) => {
                const card = cards.find((item) => item.id === id);
                if (!card) return null;
                return (
                  <div key={id} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 rounded-lg bg-[var(--navy)]/[0.03] p-2">
                    <span className="truncate text-sm font-medium">{card.name} <span className="text-xs text-[var(--muted)]">· {getCardTypeLabel(card)} · {rarityNames[card.rarity] ?? card.rarity}</span></span>
                    <label className="text-xs">Tỉ lệ %
                      <input type="number" min="0.0001" max="100" step="0.0001" value={dropRates[id] ?? 0} onChange={(event) => setDropRates((current) => ({ ...current, [id]: Number(event.target.value) }))} className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1 text-sm" />
                    </label>
                    <button type="button" onClick={() => setSelectedCardIds((current) => current.filter((cardId) => cardId !== id))} className="text-sm text-rose-700 hover:underline">Bỏ</button>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <select value={cardToAdd} onChange={(event) => setCardToAdd(event.target.value)} className={`${inputClass} max-w-sm`}>
                  <option value="">Chọn thẻ banner để thêm</option>
                  {cards.filter((card) => (card.category === "BATTLE" || !card.specialOnly) && !selectedCardIds.includes(card.id)).map((card) => <option key={card.id} value={card.id}>{card.name} · {getCardTypeLabel(card)} · {card.rarity}</option>)}
                </select>
                <button type="button" disabled={!cardToAdd || selectedCardIds.length >= 20} onClick={() => {
                  setSelectedCardIds((current) => [...current, cardToAdd]);
                  setDropRates((current) => ({ ...current, [cardToAdd]: 0 }));
                  setCardToAdd("");
                }} className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:border-[var(--teal)] disabled:opacity-50">Thêm thẻ</button>
              </div>
            </div>
          )}
        </section>
        {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>}
        <button disabled={pending || Math.round(totalRate * 10_000) !== 1_000_000} className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Đang tạo..." : "Tạo banner"}
        </button>
      </form>

      <form onSubmit={submitCard} className="space-y-4 rounded-xl border border-fuchsia-200 bg-[var(--paper)] p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Tạo thẻ</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Thẻ trưng bày dùng để sưu tầm; thẻ Quái vật, Phép và Bẫy có thể đưa vào banner Gacha.</p>
          <Link href="/admin/cards" className="mt-2 inline-flex text-sm font-semibold text-[var(--teal)] hover:underline">Quản lý / chỉnh sửa thẻ đã tạo →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên thẻ"><input name="name" required maxLength={100} className={inputClass} /></Field>
          <Field label="Slug"><input name="slug" required minLength={2} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} title="Slug cần ít nhất 2 ký tự, chỉ gồm chữ thường, số và dấu gạch ngang." className={inputClass} /></Field>
          <Field label="Nguồn nhận">
            <select name="specialOnly" className={inputClass}>
              <option value="false">Banner gacha</option>
              <option value="true">Thẻ đặc biệt · bài tập/contest</option>
            </select>
          </Field>
          <Field label="Độ hiếm"><select name="rarity" className={inputClass}>{GACHA_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarityNames[rarity]}</option>)}</select></Field>
          <Field label="Mô tả"><input name="description" maxLength={500} className={inputClass} /></Field>
          <Field label="Ảnh (JPEG/PNG/WebP/GIF, tối đa 3 MB)"><input name="image" required type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="w-full text-xs" /></Field>
        </div>
        {specialCards.length > 0 && <p className="text-xs text-[var(--muted)]">Đã có {specialCards.length} thẻ đặc biệt để gắn vào bài/contest.</p>}
        <button disabled={cardPending} className="rounded-lg border border-fuchsia-400 px-4 py-2 text-sm font-semibold text-fuchsia-800 disabled:opacity-60">{cardPending ? "Đang tạo..." : "Tạo thẻ"}</button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Banner hiện có ({banners.length})</h2>
        {banners.map((banner) => (
          <article key={banner.id} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[var(--navy)]">{banner.title} <span className="ml-1 rounded-full bg-[var(--navy)]/5 px-2 py-0.5 text-xs">{banner.type === "LIMITED" ? "Giới hạn" : "Thường"}</span></h3>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">{banner.slug}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{banner.cards.map(({ card, dropRate }) => `${card.name} (${getCardTypeLabel(card)} · ${rarityNames[card.rarity] ?? card.rarity} · ${dropRate}%)`).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-[var(--ink)]">Pity Huyền thoại · 0 = tắt
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      value={bannerPityDrafts[banner.id] ?? banner.legendaryPity}
                      onChange={(event) => setBannerPityDrafts((current) => ({ ...current, [banner.id]: Number(event.target.value) }))}
                      className="mt-1 block w-40 rounded border border-[var(--line)] px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={(bannerPityDrafts[banner.id] ?? banner.legendaryPity) === banner.legendaryPity}
                    onClick={() => void saveBannerPity(banner.id, bannerPityDrafts[banner.id] ?? banner.legendaryPity)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--teal)] disabled:opacity-40"
                  >
                    Lưu pity
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={banner.active} onClick={() => setBannerActive(banner.id, !banner.active)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${banner.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                  {banner.active ? "Đang bật · Tắt" : "Đang tắt · Bật"}
                </button>
                <button
                  type="button"
                  onClick={() => editingBannerId === banner.id ? setEditingBannerId(null) : startEditingBanner(banner)}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--teal)]"
                >
                  {editingBannerId === banner.id ? "Đóng quản lý" : "Quản lý thẻ"}
                </button>
                <button
                  type="button"
                  disabled={bannerDeletingId === banner.id}
                  onClick={() => void deleteBanner(banner)}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {bannerDeletingId === banner.id ? "Đang xóa..." : "Xóa banner"}
                </button>
              </div>
            </div>
            {editingBannerId === banner.id && (
              <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--navy)]">Thẻ và tỉ lệ rơi</h4>
                  {(() => {
                    const draft = bannerCardDrafts[banner.id] ?? [];
                    const total = draft.reduce((sum, item) => sum + (Number(item.dropRate) || 0), 0);
                    return <span className={`text-sm font-bold ${Math.round(total * 10_000) === 1_000_000 ? "text-emerald-700" : "text-rose-700"}`}>Tổng: {total.toFixed(4)}%</span>;
                  })()}
                </div>
                <div className="space-y-2">
                  {(bannerCardDrafts[banner.id] ?? []).map((item) => {
                    const card = cards.find((candidate) => candidate.id === item.cardId);
                    if (!card) return null;
                    return (
                      <div key={item.cardId} className="grid grid-cols-[minmax(0,1fr)_130px_auto] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2">
                        <span className="truncate text-sm font-medium">{card.name}<span className="ml-1 text-xs text-[var(--muted)]">· {getCardTypeLabel(card)} · {rarityNames[card.rarity] ?? card.rarity}</span></span>
                        <label className="text-xs">Tỉ lệ %
                          <input
                            type="number"
                            min="0.0001"
                            max="100"
                            step="0.0001"
                            value={item.dropRate}
                            onChange={(event) => setBannerCardDrafts((current) => ({
                              ...current,
                              [banner.id]: (current[banner.id] ?? []).map((draft) => draft.cardId === item.cardId ? { ...draft, dropRate: Number(event.target.value) } : draft),
                            }))}
                            className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={(bannerCardDrafts[banner.id] ?? []).length <= 1}
                          onClick={() => setBannerCardDrafts((current) => ({
                            ...current,
                            [banner.id]: (current[banner.id] ?? []).filter((draft) => draft.cardId !== item.cardId),
                          }))}
                          className="text-sm font-medium text-rose-700 hover:underline disabled:opacity-30"
                        >
                          Bỏ thẻ
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={bannerCardToAdd} onChange={(event) => setBannerCardToAdd(event.target.value)} className={`${inputClass} max-w-md`}>
                    <option value="">Chọn thẻ để thêm</option>
                    {cards.filter((card) =>
                      (card.category === "BATTLE" || !card.specialOnly) &&
                      !(bannerCardDrafts[banner.id] ?? []).some((item) => item.cardId === card.id),
                    ).map((card) => (
                      <option key={card.id} value={card.id}>{card.name} · {getCardTypeLabel(card)} · {card.rarity}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!bannerCardToAdd || (bannerCardDrafts[banner.id] ?? []).length >= 20}
                    onClick={() => {
                      setBannerCardDrafts((current) => ({
                        ...current,
                        [banner.id]: [...(current[banner.id] ?? []), { cardId: bannerCardToAdd, dropRate: 0.0001 }],
                      }));
                      setBannerCardToAdd("");
                    }}
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:border-[var(--teal)] disabled:opacity-50"
                  >
                    Thêm thẻ
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">Điều chỉnh các tỉ lệ để tổng đúng 100% (tối đa 4 số thập phân) trước khi lưu.</p>
                <button
                  type="button"
                  disabled={bannerSaving || Math.round((bannerCardDrafts[banner.id] ?? []).reduce((sum, item) => sum + (Number(item.dropRate) || 0), 0) * 10_000) !== 1_000_000}
                  onClick={() => void saveBannerCards(banner.id)}
                  className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bannerSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            )}
          </article>
        ))}
        {message && <p role={error ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}
      </section>
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium text-[var(--ink)]"><span>{label}</span>{children}</label>;
}
