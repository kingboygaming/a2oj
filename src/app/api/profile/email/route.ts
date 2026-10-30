import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmailVerification } from "@/lib/email";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  currentPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = emailSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không hợp lệ." }, { status: 400 });
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      passwordHash: true,
      email: true,
      pendingEmail: true,
      emailVerificationSentAt: true,
    },
  });
  if (!account || !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
  }
  if (parsed.data.email === account.email) {
    return NextResponse.json({ error: "Email này đã được liên kết với tài khoản." }, { status: 400 });
  }
  if (
    account.emailVerificationSentAt &&
    Date.now() - account.emailVerificationSentAt.getTime() < 60_000
  ) {
    return NextResponse.json(
      { error: "Vui lòng đợi một phút trước khi gửi liên kết xác minh tiếp theo." },
      { status: 429 },
    );
  }

  const emailOwner = await prisma.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { pendingEmail: parsed.data.email }],
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (emailOwner) {
    return NextResponse.json({ error: "Email này đã được dùng cho tài khoản khác." }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pendingEmail: parsed.data.email,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      emailVerificationSentAt: new Date(),
    },
  });

  try {
    await sendEmailVerification(parsed.data.email, token);
  } catch (error) {
    console.error("Failed to send email verification.", error);
    await prisma.user.updateMany({
      where: { id: user.id, emailVerificationTokenHash: tokenHash },
      data: {
        pendingEmail: null,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
      },
    });
    return NextResponse.json(
      { error: "Không gửi được email xác minh. Hãy kiểm tra cấu hình SMTP rồi thử lại." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Đã gửi liên kết xác minh. Liên kết có hiệu lực trong 30 phút.",
  });
}

const tokenSchema = z.object({ token: z.string().min(40).max(100) });

export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = tokenSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Liên kết xác minh không hợp lệ." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const account = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { gt: new Date() },
      pendingEmail: { not: null },
    },
    select: { id: true, pendingEmail: true },
  });
  if (!account?.pendingEmail) {
    return NextResponse.json(
      { error: "Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.user.updateMany({
      where: {
        id: account.id,
        pendingEmail: account.pendingEmail,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
      data: {
        email: account.pendingEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới." },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email này đã được dùng cho tài khoản khác." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
