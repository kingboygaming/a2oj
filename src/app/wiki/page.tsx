import Link from "next/link";
import { getCurrentUser, canManageContests } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { wikiResources } from "@/lib/wiki-resources";
import { Card, CardContent } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const user = await getCurrentUser();
  const canWrite = !!user && canManageContests(user.role);
  const articles = await prisma.wikiArticle.findMany({
    where: canWrite
      ? user.role === "ADMIN"
        ? {}
        : { OR: [{ published: true }, { authorId: user.id }] }
      : { published: true },
    orderBy: [{ updatedAt: "desc" }],
    include: { author: { select: { displayName: true } } },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/10 via-transparent to-[var(--amber)]/10 pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden="true">📚</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
                Thư viện kiến thức
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--navy)]">
              A2OJ Wiki
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)] max-w-2xl">
              Tài liệu thuật toán, cấu trúc dữ liệu và kinh nghiệm lập trình thi đấu do cộng đồng chuyên Tin biên soạn.
            </p>
          </div>
          {canWrite && (
            <Button href="/wiki/new" variant="primary" icon="✏️" iconPosition="left">
              Soạn bài mới
            </Button>
          )}
        </div>
      </div>

      {/* Roadmap Banner */}
      <Link href="/wiki/roadmap" className="group block">
        <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--teal)]/30 bg-gradient-to-r from-[var(--teal)]/15 via-[var(--teal)]/5 to-[var(--paper)] p-6 sm:p-7 transition-all duration-300 hover:border-[var(--teal)]/60 hover:shadow-xl hover:shadow-[var(--teal)]/10 hover:-translate-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--teal)]/20 text-2xl shadow-inner shadow-[var(--teal)]/20 transition-transform group-hover:scale-110">
                🗺️
              </div>
              <div>
                <Badge variant="teal" size="sm" className="mb-1 font-semibold">
                  LỘ TRÌNH HỌC TẬP
                </Badge>
                <h2 className="text-xl font-bold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors">
                  Lộ trình học thuật toán từ cơ bản đến nâng cao
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Khám phá các giai đoạn, chủ đề trọng tâm, mốc kiểm tra và bài tập tuyển chọn.
                </p>
              </div>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-[var(--teal)] transition-transform group-hover:translate-x-1 group-hover:bg-[var(--teal)] group-hover:text-white">
              →
            </div>
          </div>
        </div>
      </Link>
      {/* Internal Articles */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--navy)]">Bài viết trong A2OJ</h2>
            <p className="text-xs text-[var(--muted)]">Các bài chia sẻ thuật toán và lời giải từ giáo viên & học sinh</p>
          </div>
          <span className="text-xs font-semibold text-[var(--muted)]">
            {articles.length} bài viết
          </span>
        </div>

        {articles.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((a) => (
              <Card key={a.id} hover variant="glass" className="overflow-hidden">
                <Link href={`/wiki/${a.slug}`} className="block p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="teal" size="sm">
                      {a.category}
                    </Badge>
                    {!a.published && (
                      <Badge variant="warning" size="sm">
                        Bản nháp
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[var(--navy)] hover:text-[var(--teal)] transition-colors">
                    {a.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
                    {a.summary || "Chưa có tóm tắt nội dung bài viết."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--line)]/40 pt-3 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>✍️</span> {a.author.displayName}
                    </span>
                    <span className="text-[var(--teal)] font-medium">Đọc tiếp →</span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="glass">
            <CardContent className="p-8 text-center">
              <span className="text-3xl opacity-40">📝</span>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Chưa có bài viết nội bộ. Giáo viên và quản trị viên có thể bắt đầu soạn bài.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* External Resources */}
      <div className="space-y-8 pt-2">
        {wikiResources.map((group) => (
          <section key={group.category} className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--navy)] flex items-center gap-2">
                <span>📖</span> {group.category}
              </h2>
              <p className="text-xs text-[var(--muted)]">{group.description}</p>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Card key={item.url} hover variant="default" className="overflow-hidden">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-4 group"
                  >
                    <h3 className="font-semibold text-sm text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors flex items-center justify-between">
                      <span>{item.title}</span>
                      <span aria-hidden="true" className="text-xs opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                        ↗
                      </span>
                    </h3>
                    <p className="mt-1.5 text-xs text-[var(--muted)] leading-relaxed">
                      {item.detail}
                    </p>
                    <p className="mt-3 truncate font-mono text-[11px] text-[var(--teal)]/80 group-hover:underline">
                      {item.url}
                    </p>
                  </a>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--line)]/40 bg-[var(--paper)]/50 p-4 text-xs text-[var(--muted)] text-center">
        💡 Tài liệu tham khảo thuộc VNOI Wiki và các nguồn mở; các liên kết sẽ mở trang gốc để tôn trọng bản quyền tác giả.
      </div>
    </div>
  );
}
