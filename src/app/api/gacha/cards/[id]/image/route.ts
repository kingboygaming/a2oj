import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const card = await prisma.gachaCard.findUnique({
    where: { id },
    select: { imageData: true, imageMimeType: true },
  });
  if (!card?.imageData || !card.imageMimeType) return new Response("Not found", { status: 404 });
  const imageBytes = card.imageData instanceof Uint8Array
    ? card.imageData
    : new Uint8Array(card.imageData);
  return new Response(imageBytes, {
    headers: {
      "Content-Type": card.imageMimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
