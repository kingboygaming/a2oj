import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ slug: z.string().trim().toLowerCase().min(2).max(100).regex(/^[a-z0-9-]+$/), title: z.string().trim().min(2).max(160), category: z.string().trim().min(2).max(60), summary: z.string().max(300).default(""), content: z.string().min(10), sourceName: z.string().max(120).optional().default(""), sourceUrl: z.union([z.string().url(), z.literal("")]).optional().default(""), published: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional().transform(v => v === true || v === "true") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); const { id } = await params;
  if (!user || !canManageContests(user.role)) return NextResponse.json({ error: "Bạn không có quyền sửa Wiki." }, { status: 403 });
  const article = await prisma.wikiArticle.findUnique({ where: { id }, select: { authorId: true } });
  if (!article || (article.authorId !== user.id && user.role !== "ADMIN")) return NextResponse.json({ error: "Không tìm thấy bài viết hoặc bạn không có quyền sửa." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin bài viết chưa hợp lệ." }, { status: 400 });
  const duplicate = await prisma.wikiArticle.findFirst({ where: { slug: parsed.data.slug, NOT: { id } }, select: { id: true } });
  if (duplicate) return NextResponse.json({ error: "Đường dẫn này đã được sử dụng." }, { status: 409 });
  const updated = await prisma.wikiArticle.update({ where: { id }, data: { ...parsed.data, sourceName: parsed.data.sourceName || null, sourceUrl: parsed.data.sourceUrl || null } });
  return NextResponse.json({ slug: updated.slug });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); const { id } = await params;
  if (!user || !canManageContests(user.role)) return NextResponse.json({ error: "Bạn không có quyền xóa Wiki." }, { status: 403 });
  const result = await prisma.wikiArticle.deleteMany({ where: { id, ...(user.role === "ADMIN" ? {} : { authorId: user.id }) } });
  if (!result.count) return NextResponse.json({ error: "Không tìm thấy bài viết hoặc bạn không có quyền xóa." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
