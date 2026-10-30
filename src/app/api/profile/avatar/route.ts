import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
type AvatarMimeType = "image/jpeg" | "image/png" | "image/webp";

function isAvatarType(bytes: Uint8Array, mimeType: string): mimeType is AvatarMimeType {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Ảnh đại diện tối đa 2 MB." }, { status: 413 });
  }
  if (!request.body) {
    return NextResponse.json({ error: "Không nhận được dữ liệu ảnh." }, { status: 400 });
  }

  const mimeType = request.headers.get("content-type") ?? "";
  let bytes: Uint8Array<ArrayBuffer>;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_AVATAR_SIZE) {
        await reader.cancel();
        return NextResponse.json({ error: "Ảnh đại diện tối đa 2 MB." }, { status: 413 });
      }
      chunks.push(value);
    }
    if (totalSize === 0) {
      return NextResponse.json({ error: "Hãy chọn ảnh đại diện." }, { status: 400 });
    }
    bytes = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu ảnh." }, { status: 400 });
  }

  if (!isAvatarType(bytes, mimeType)) {
    return NextResponse.json(
      { error: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarData: bytes, avatarMimeType: mimeType },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarData: null, avatarMimeType: null },
  });
  return NextResponse.json({ success: true });
}
