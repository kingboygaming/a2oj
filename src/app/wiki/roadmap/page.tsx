import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lộ trình học thuật toán | A2OJ",
  description: "Lộ trình gợi ý để học và luyện tập thuật toán từ cơ bản đến nâng cao.",
};

export default async function RoadmapPage() {
  const [user, savedStages] = await Promise.all([
    getCurrentUser(),
    prisma.roadmapStage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const stages = savedStages.map((stage, index) => ({
    ...stage,
    number: String(index + 1).padStart(2, "0"),
    topics: JSON.parse(stage.topics) as string[],
    resources: JSON.parse(stage.resources) as { label: string; href: string }[],
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-wide text-[var(--teal)]">A2OJ · HỌC VÀ LUYỆN TẬP</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--navy)] sm:text-4xl">Lộ trình học thuật toán</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Đi từ những bước đầu tiên với C++ đến các chủ đề nâng cao qua các chặng gợi ý.
          Hãy học theo nhịp độ của bạn, luyện bài thường xuyên và quay lại ôn nền tảng khi cần.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/problems"
            className="inline-flex items-center rounded-lg bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Bắt đầu luyện bài <span aria-hidden="true" className="ml-2">→</span>
          </Link>
          <Link
            href="/wiki"
            className="inline-flex items-center rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] hover:border-[var(--teal)]"
          >
            Mở thư viện Wiki
          </Link>
        </div>
      </header>

      <section aria-labelledby="roadmap-stages-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="roadmap-stages-heading" className="text-2xl font-semibold text-[var(--navy)]">Các chặng học</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Thứ tự tham khảo — có thể điều chỉnh theo kiến thức hiện tại.</p>
          </div>
          <span className="text-xs text-[var(--muted)]">{stages.length} chặng</span>
          {user?.role === "ADMIN" && (
            <Link href="/wiki/roadmap/manage" className="text-sm font-semibold text-[var(--teal)] hover:underline">
              Quản lý lộ trình
            </Link>
          )}
        </div>

        {stages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">
            Lộ trình đang được cập nhật.
          </p>
        ) : <ol className="space-y-4">
          {stages.map((stage) => (
            <li key={stage.number} className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
              <div className="flex items-start sm:justify-center">
                <span className="flex size-11 items-center justify-center rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">
                  {stage.number}
                </span>
              </div>
              <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--teal)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--teal)]">
                    {stage.level}
                  </span>
                  <h3 className="text-lg font-semibold text-[var(--navy)]">{stage.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{stage.description}</p>
                <ul className="mt-4 grid gap-2 text-sm text-[var(--navy)] sm:grid-cols-2">
                  {stage.topics.map((topic) => (
                    <li key={topic} className="flex gap-2">
                      <span aria-hidden="true" className="text-[var(--teal)]">•</span>
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 rounded-lg bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--navy)]">Mốc tự kiểm tra:</span> {stage.checkpoint}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href="/problems" className="text-sm font-semibold text-[var(--teal)] hover:underline">
                    Luyện bài trên A2OJ →
                  </Link>
                  {stage.resources.map((resource) => (
                    <a
                      key={resource.href}
                      href={resource.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--muted)] hover:text-[var(--teal)] hover:underline"
                    >
                      {resource.label} ↗
                    </a>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>}
      </section>

      <p className="text-xs leading-5 text-[var(--muted)]">
        Lộ trình mang tính tham khảo, không phải chương trình bắt buộc. Tài liệu ngoài A2OJ sẽ mở ở tab mới và thuộc về nguồn được liên kết.
      </p>
    </div>
  );
}
