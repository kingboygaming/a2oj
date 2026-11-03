"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GACHA_RARITIES } from "@/lib/gacha";

type Category = "DISPLAY" | "BATTLE";
type BugPart = "" | "CE" | "TLE" | "MLE" | "WA" | "PE";
type PassiveKey = "critRate" | "evasionRate" | "counterRate" | "lifeStealRate";

type CardDraft = {
  name: string;
  slug: string;
  description: string;
  category: Category;
  rarity: string;
  attack: number;
  defense: number;
  manaCost: number;
  level: number;
  element: string;
  icon: string;
  critRate: number;
  evasionRate: number;
  counterRate: number;
  lifeStealRate: number;
  specialEffect: string;
  bugPart: BugPart;
  specialOnly: boolean;
};

const INITIAL_DRAFT: CardDraft = {
  name: "",
  slug: "",
  description: "",
  category: "DISPLAY",
  rarity: "R",
  attack: 1500,
  defense: 1200,
  manaCost: 3,
  level: 4,
  element: "Tin học",
  icon: "🃏",
  critRate: 0,
  evasionRate: 0,
  counterRate: 0,
  lifeStealRate: 0,
  specialEffect: "NONE",
  bugPart: "",
  specialOnly: false,
};

const rarityLabel: Record<string, string> = {
  R: "Rare",
  SR: "Super Rare",
  SSR: "Super Special Rare",
  COMMON: "Thường",
  UNCOMMON: "Không phổ biến",
  RARE: "Hiếm",
  EPIC: "Sử thi",
  LEGENDARY: "Huyền thoại",
  SPECIAL: "Đặc biệt",
};

const passiveOptions: { key: PassiveKey; label: string; icon: string }[] = [
  { key: "critRate", label: "Bạo kích ×2", icon: "💥" },
  { key: "evasionRate", label: "Né đòn", icon: "💨" },
  { key: "counterRate", label: "Phản đòn", icon: "↩️" },
  { key: "lifeStealRate", label: "Hút máu", icon: "🩸" },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomPassives(): Pick<CardDraft, PassiveKey> {
  return {
    critRate: randomInt(0, 25),
    evasionRate: randomInt(0, 20),
    counterRate: randomInt(0, 20),
    lifeStealRate: randomInt(0, 15),
  };
}

export function CardStudio() {
  const router = useRouter();
  const [draft, setDraft] = useState<CardDraft>(INITIAL_DRAFT);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function selectImage(file: File | null) {
    setImage(file);
    setImageUrl(file ? URL.createObjectURL(file) : "");
  }

  const activePassives = useMemo(
    () => passiveOptions.filter(({ key }) => draft[key] > 0),
    [draft],
  );
  const previewAttack = ["SLIFER", "RA", "OBELISK"].includes(draft.specialEffect)
    ? 4000
    : draft.attack;
  const previewDefense = ["SLIFER", "RA", "OBELISK"].includes(draft.specialEffect)
    ? 4000
    : draft.defense;

  function update<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function generateCard() {
    if (draft.category === "BATTLE") {
      const attack = randomInt(500, 3000);
      const defense = randomInt(500, 3000);
      const manaCost = randomInt(1, 5);
      const algorithmLines = [
        `Tối ưu hóa O(N log N), ${draft.name || "thực thể"} sắp xếp mọi trạng thái hỗn loạn.`,
        `Dùng quy hoạch động để giảm độ phức tạp của ${draft.name || "bài toán"} về O(N).`,
        `Một cấu trúc dữ liệu vững chắc: truy vấn nhanh, không để bug thoát khỏi cây.`,
        `Áp dụng greedy đúng lúc; chứng minh tính đúng đắn trước khi nộp lời giải.`,
      ];
      setDraft((current) => ({
        ...current,
        slug: current.slug || slugify(current.name),
        attack,
        defense,
        manaCost,
        level: Math.min(12, Math.max(1, Math.ceil(attack / 350))),
        description: algorithmLines[randomInt(0, algorithmLines.length - 1)],
        ...randomPassives(),
      }));
      return;
    }

    const rarity = ["R", "SR", "SSR"][randomInt(0, 2)];
    const titles = [
      "Người gìn giữ lời giải tối ưu.",
      "Huyền thoại của những lần AC liên tiếp.",
      "Bậc thầy biến bug thành tính năng.",
      "Chiến binh bền bỉ qua mọi test ẩn.",
    ];
    setDraft((current) => ({
      ...current,
      slug: current.slug || slugify(current.name),
      rarity,
      description: `Danh hiệu độc quyền từ Admin: ${titles[randomInt(0, titles.length - 1)]}`,
      critRate: 0,
      evasionRate: 0,
      counterRate: 0,
      lifeStealRate: 0,
    }));
  }

  async function submitCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(false);
    setMessage("");
    const formData = new FormData();
    Object.entries(draft).forEach(([key, value]) => {
      formData.set(key, String(value));
    });
    if (image) formData.set("image", image);

    try {
      const response = await fetch("/api/admin/cards", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể tạo thẻ.");
        return;
      }
      setMessage(`Đã tạo ${draft.category === "BATTLE" ? "thẻ chiến đấu" : "thẻ trưng bày"} "${result.card.name}".`);
      setDraft(INITIAL_DRAFT);
      selectImage(null);
      form.reset();
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]";

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <form onSubmit={submitCard} className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--navy)]">Tạo thẻ mới</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Tạo thẻ sưu tầm hoặc thẻ dùng được trong phòng PvP.</p>
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          {([
            ["DISPLAY", "Thẻ trưng bày", "Sưu tầm, dùng trên profile; không có chỉ số chiến đấu."],
            ["BATTLE", "Thẻ chiến đấu", "Có ATK/DEF, kỹ năng ẩn và có thể đưa vào phòng đấu."],
          ] as const).map(([category, title, detail]) => (
            <label key={category} className={`cursor-pointer rounded-xl border p-4 ${draft.category === category ? "border-[var(--teal)] bg-[var(--teal)]/10" : "border-[var(--line)]"}`}>
              <input
                type="radio"
                name="categoryChoice"
                checked={draft.category === category}
                onChange={() => setDraft((current) => ({
                  ...current,
                  category,
                  ...(category === "DISPLAY" ? {
                    critRate: 0,
                    evasionRate: 0,
                    counterRate: 0,
                    lifeStealRate: 0,
                    specialEffect: "NONE",
                    bugPart: "",
                  } : {}),
                }))}
                className="mr-2 accent-[var(--teal)]"
              />
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block pl-6 text-xs leading-5 text-[var(--muted)]">{detail}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên thẻ">
            <input required maxLength={100} value={draft.name} onChange={(event) => {
              const name = event.target.value;
              setDraft((current) => ({
                ...current,
                name,
                slug: current.slug === slugify(current.name) || !current.slug ? slugify(name) : current.slug,
              }));
            }} className={inputClass} />
          </Field>
          <Field label="Slug">
            <input required minLength={2} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => update("slug", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Độ hiếm">
            <select value={draft.rarity} onChange={(event) => update("rarity", event.target.value)} className={inputClass}>
              {GACHA_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarityLabel[rarity] ?? rarity}</option>)}
            </select>
          </Field>
          <Field label="Danh mục hiển thị">
            <input value={draft.element} maxLength={30} onChange={(event) => update("element", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Icon (emoji)">
            <input value={draft.icon} maxLength={12} onChange={(event) => update("icon", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Ảnh minh họa (tùy chọn, tối đa 3 MB)">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} className="w-full text-xs" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mô tả / hiệu ứng">
              <textarea rows={3} maxLength={500} value={draft.description} onChange={(event) => update("description", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </div>

        {draft.category === "BATTLE" && (
          <section className="space-y-4 rounded-xl border border-cyan-400/20 bg-cyan-950/10 p-4">
            <h3 className="font-semibold text-cyan-200">Chỉ số chiến đấu</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <NumberField label="ATK" min={500} max={3000} value={draft.attack} onChange={(value) => update("attack", value)} />
              <NumberField label="DEF" min={500} max={3000} value={draft.defense} onChange={(value) => update("defense", value)} />
              <NumberField label="Mana Cost" min={1} max={5} value={draft.manaCost} onChange={(value) => update("manaCost", value)} />
              <NumberField label="Cấp" min={1} max={12} value={draft.level} onChange={(value) => update("level", value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nội tại đặc biệt">
                <select value={draft.specialEffect} onChange={(event) => update("specialEffect", event.target.value)} className={inputClass}>
                  <option value="NONE">Không có</option>
                  <option value="SLIFER">Slifer · tăng ATK/DEF theo số bài trên tay</option>
                  <option value="RA">Ra · hiến tế LP để tăng ATK</option>
                  <option value="OBELISK">Obelisk · Thần Ai Cập</option>
                </select>
              </Field>
              <Field label="Mảnh Compile Exodia">
                <select value={draft.bugPart} onChange={(event) => update("bugPart", event.target.value as BugPart)} className={inputClass}>
                  <option value="">Không phải mảnh</option>
                  <option value="CE">CE · Compile Error</option>
                  <option value="TLE">TLE · Time Limit</option>
                  <option value="MLE">MLE · Memory Limit</option>
                  <option value="WA">WA · Wrong Answer</option>
                  <option value="PE">PE · Presentation Error</option>
                </select>
              </Field>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-[var(--ink)]">Nội tại ẩn · % kích hoạt</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {passiveOptions.map(({ key, label, icon }) => (
                  <NumberField key={key} label={`${icon} ${label}`} min={0} max={100} value={draft[key]} onChange={(value) => update(key, value)} />
                ))}
              </div>
            </div>
          </section>
        )}

        {draft.category === "DISPLAY" && (
          <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={draft.specialOnly} onChange={(event) => update("specialOnly", event.target.checked)} className="mt-1 accent-[var(--teal)]" />
            Chỉ nhận từ phần thưởng bài tập/contest, không xuất hiện trong banner gacha.
          </label>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={generateCard} className="rounded-lg border border-violet-400/40 px-4 py-2 text-sm font-bold text-violet-200 hover:bg-violet-400/10">
            ⚡ Tự động tạo thông minh
          </button>
          <button disabled={pending} className="rounded-lg bg-[var(--teal)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {pending ? "Đang lưu..." : "Tạo thẻ"}
          </button>
        </div>
        {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-400" : "text-emerald-400"}`}>{message}</p>}
      </form>

      <aside className="sticky top-6 space-y-3">
        <h2 className="text-lg font-bold text-[var(--navy)]">Live Card Preview</h2>
        <article className={`group relative mx-auto min-h-96 max-w-xs overflow-hidden rounded-3xl border-2 p-4 shadow-xl transition duration-500 hover:scale-[1.03] ${
          draft.rarity === "SSR" || draft.rarity === "LEGENDARY"
            ? "border-amber-300 bg-gradient-to-br from-amber-300/20 via-fuchsia-500/10 to-cyan-300/20 shadow-amber-300/10"
            : draft.rarity === "SR" || draft.rarity === "EPIC"
              ? "border-violet-300 bg-gradient-to-br from-violet-400/20 to-cyan-500/10"
              : "border-slate-400 bg-gradient-to-br from-slate-700/70 to-slate-900"
        }`}>
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">{draft.element || "Tin học"}</span>
            <span className="rounded-full bg-black/30 px-2 py-1 text-xs font-bold">{rarityLabel[draft.rarity] ?? draft.rarity}</span>
          </div>
          <div className="relative mt-4 grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            {imageUrl ? (
              <Image src={imageUrl} alt="Xem trước thẻ" fill unoptimized className="object-cover" />
            ) : <span className="text-7xl">{draft.icon || "🃏"}</span>}
          </div>
          <h3 className="relative mt-4 truncate text-xl font-black">{draft.name || "Tên thẻ"}</h3>
          <p className="relative mt-2 min-h-12 text-xs leading-5 text-slate-300">
            {draft.category === "DISPLAY" ? draft.description || "Danh hiệu độc quyền sẽ hiển thị tại đây." : draft.description || "Mô tả chiến đấu sẽ hiển thị tại đây."}
          </p>
          {draft.category === "BATTLE" && (
            <div className="relative mt-3 flex justify-between rounded-lg bg-black/30 px-3 py-2 text-xs font-bold">
              <span>ATK {previewAttack}</span><span>DEF {previewDefense}</span><span>💎 {draft.manaCost}</span>
            </div>
          )}
          {activePassives.length > 0 && (
            <div className="relative mt-3 flex min-h-8 flex-wrap gap-1">
              {activePassives.map(({ key, icon, label }) => (
                <span key={key} title={`${label}: ${draft[key]}%`} className="rounded-full border border-white/15 bg-slate-950/70 px-2 py-1 text-[10px]">
                  {icon} {draft[key]}%
                </span>
              ))}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-3 text-xs opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
            <p className="mb-2 font-bold text-cyan-200">Nội tại ẩn</p>
            {activePassives.length === 0 ? <p className="text-slate-400">Chưa có nội tại.</p> : activePassives.map(({ key, label, icon }) => (
              <p key={key} className="py-0.5">{icon} {label}: {draft[key]}%</p>
            ))}
          </div>
        </article>
        <p className="text-center text-xs text-[var(--muted)]">
          {draft.category === "DISPLAY" ? "Thẻ sưu tầm · chỉ số chiến đấu được ẩn" : "Thẻ Battle Ready · kéo vào deck PvP"}
        </p>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium text-[var(--ink)]"><span>{label}</span>{children}</label>;
}

function NumberField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-xs font-medium text-[var(--muted)]">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]" />
    </label>
  );
}
