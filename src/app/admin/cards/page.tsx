import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const cardTypeLabels: Record<string, string> = {
  DISPLAY: "Trưng bày",
  MONSTER: "Quái vật",
  SPELL: "Phép",
  TRAP: "Bẫy",
};

export default async function AdminCardsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const cards = await prisma.gachaCard.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rarity: true,
      category: true,
      battleType: true,
      attack: true,
      defense: true,
      manaCost: true,
      requiredTributes: true,
      imageMimeType: true,
    },
  });

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản trị
      </Link>
      <header className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">A2OJ Card Studio</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Quản lý thẻ</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Chỉnh sửa thông tin, chỉ số, hiệu ứng và ảnh của thẻ đã tạo.</p>
        </div>
        <Link href="/admin/cards/new" className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white">
          + Tạo thẻ mới
        </Link>
      </header>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
          Chưa có thẻ nào. Tạo thẻ đầu tiên để bắt đầu.
        </p>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const type = card.category === "BATTLE" ? card.battleType : "DISPLAY";
            return (
              <article key={card.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
                <div
                  className="size-16 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--background)] bg-cover bg-center"
                  style={card.imageMimeType ? { backgroundImage: `url("/api/gacha/cards/${card.id}/image")` } : undefined}
                  role={card.imageMimeType ? "img" : undefined}
                  aria-label={card.imageMimeType ? card.name : undefined}
                >
                  {!card.imageMimeType && <span className="grid size-full place-items-center text-2xl">🃏</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-[var(--navy)]">{card.name}</h2>
                  <p className="text-xs text-[var(--muted)]">{cardTypeLabels[type] ?? type} · {card.rarity}</p>
                  {card.category === "BATTLE" && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {card.battleType === "MONSTER" ? `ATK ${card.attack} · DEF ${card.defense}${card.requiredTributes != null ? ` · Hiến tế ${card.requiredTributes}` : ""} · ` : ""}💎 {card.manaCost}
                    </p>
                  )}
                </div>
                <Link
                  href={`/admin/cards/${card.id}/edit`}
                  className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--teal)] hover:border-[var(--teal)]"
                >
                  Chỉnh sửa
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
