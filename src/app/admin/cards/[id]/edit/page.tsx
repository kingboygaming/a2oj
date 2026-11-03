import Link from "next/link";
import { notFound } from "next/navigation";
import { CardStudio, type EditableCard } from "@/components/CardStudio";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditAdminCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const { id } = await params;
  const card = await prisma.gachaCard.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      battleType: true,
      rarity: true,
      attack: true,
      defense: true,
      manaCost: true,
      level: true,
      element: true,
      icon: true,
      critRate: true,
      evasionRate: true,
      counterRate: true,
      lifeStealRate: true,
      specialEffect: true,
      bugPart: true,
      specialOnly: true,
      imageMimeType: true,
    },
  });
  if (!card) notFound();

  const initialCard: EditableCard = {
    ...card,
    category: card.category === "BATTLE" ? "BATTLE" : "DISPLAY",
    battleType: card.battleType === "SPELL" || card.battleType === "TRAP" ? card.battleType : "MONSTER",
    bugPart: card.bugPart === "CE" || card.bugPart === "TLE" || card.bugPart === "MLE" || card.bugPart === "WA" || card.bugPart === "PE"
      ? card.bugPart
      : "",
    imageUrl: card.imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
  };

  return (
    <div>
      <Link href="/admin/cards" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản lý thẻ
      </Link>
      <header className="mb-6 mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">A2OJ Card Studio</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Chỉnh sửa: {card.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Cập nhật nội dung, chỉ số, hiệu ứng hoặc ảnh. ATK/DEF cơ bản tối đa 5000; hiệu ứng buff trong trận vẫn có thể vượt mức này.
        </p>
      </header>
      <CardStudio key={card.id} initialCard={initialCard} />
    </div>
  );
}
