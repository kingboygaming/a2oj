import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ slug: z.string().trim().toLowerCase().min(2).max(100).regex(/^[a-z0-9-]+$/), title: z.string().trim().min(2).max(160), category: z.string().trim().min(2).max(60), summary: z.string().max(300).default(""), content: z.string().min(10), sourceName: z.string().max(120).optional().default(""), sourceUrl: z.union([z.string().url(), z.literal("")]).optional().default(""), published: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional().transform(v => v === true || v === "true") });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageContests(user.role)) return NextResponse.json({ error: "Chỉ giáo viên hoặc quản trị viên mới được soạn Wiki." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin bài viết chưa hợp lệ." }, { status: 400 });
  const exists = await prisma.wikiArticle.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "Đường dẫn này đã được sử dụng." }, { status: 409 });
  const article = await prisma.wikiArticle.create({ data: { ...parsed.data, sourceName: parsed.data.sourceName || null, sourceUrl: parsed.data.sourceUrl || null, authorId: user.id } });
  return NextResponse.json({ slug: article.slug }, { status: 201 });
}
