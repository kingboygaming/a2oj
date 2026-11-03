import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(24, "Tên đăng nhập tối đa 24 ký tự.")
    .regex(/^[a-z0-9_]+$/, "Chỉ dùng chữ thường, số và dấu gạch dưới."),
  displayName: z
    .string()
    .trim()
    .min(2, "Tên hiển thị cần ít nhất 2 ký tự.")
    .max(60, "Tên hiển thị tối đa 60 ký tự."),
  password: z
    .string()
    .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
    .max(72, "Mật khẩu tối đa 72 ký tự."),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Thông tin đăng ký không hợp lệ." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        passwordHash,
        role: "STUDENT",
        gachaTickets: 15,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
      },
    });

    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Tên đăng nhập đã được sử dụng." },
        { status: 409 },
      );
    }
    throw error;
  }
}
