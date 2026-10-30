import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { avatarData: true, avatarMimeType: true },
  });
  if (!user?.avatarData || !user.avatarMimeType) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(Buffer.from(user.avatarData), {
    headers: {
      "Content-Type": user.avatarMimeType,
      "Content-Length": String(user.avatarData.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
