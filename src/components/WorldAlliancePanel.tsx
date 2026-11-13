"use client";

import { useEffect, useState, type FormEvent } from "react";

type AllianceSnapshot = {
  alliance: null | {
    id: string;
    name: string;
    tag: string;
    description: string;
    memberCount: number;
    leaderUserId: string;
    role: string;
    members: Array<{
      userId: string;
      name: string;
      username: string;
      role: string;
      joinedAt: string;
    }>;
  };
  directory: Array<{
    id: string;
    name: string;
    tag: string;
    description: string;
    memberCount: number;
    leaderName: string;
  }>;
  memberLimit: number;
};

type AllianceAction =
  | { action: "create"; name: string; tag: string; description: string }
  | { action: "join"; allianceId: string }
  | { action: "leave" }
  | { action: "kick"; targetUserId: string }
  | { action: "transfer"; targetUserId: string };

async function fetchAllianceSnapshot() {
  const response = await fetch("/api/world/alliance", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Không thể tải dữ liệu liên minh.");
  return result as AllianceSnapshot;
}

export function WorldAlliancePanel() {
  const [snapshot, setSnapshot] = useState<AllianceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const isLeader = snapshot?.alliance?.role === "LEADER";

  useEffect(() => {
    let active = true;
    fetchAllianceSnapshot()
      .then((result) => {
        if (active) setSnapshot(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setIsError(true);
          setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu liên minh.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    setSnapshot(await fetchAllianceSnapshot());
  }

  async function runAction(action: AllianceAction) {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/world/alliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể thực hiện thao tác liên minh.");
      await reload();
      setMessage(result.message);
      return true;
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createAlliance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const succeeded = await runAction({
      action: "create",
      name: String(formData.get("name") ?? ""),
      tag: String(formData.get("tag") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    if (succeeded) form.reset();
  }

  return (
    <section className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Nền tảng Alliance War</p>
        <h2 className="mt-1 text-xl font-bold text-[var(--navy)]">🤝 Liên minh</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Lập nhóm tối đa {snapshot?.memberLimit ?? 20} người để cùng chuẩn bị cho các hoạt động liên minh.
        </p>
      </div>

      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mb-4 rounded-lg border p-3 text-sm ${isError ? "border-rose-400/40 bg-rose-400/10 text-rose-700" : "border-emerald-500/30 bg-emerald-500/10 text-[var(--navy)]"}`}
        >
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Đang tải liên minh…</p>
      ) : snapshot?.alliance ? (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[var(--teal)]/5 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">
                [{snapshot.alliance.tag}] · {snapshot.alliance.memberCount}/{snapshot.memberLimit} thành viên
              </p>
              <h3 className="mt-1 text-lg font-bold text-[var(--navy)]">{snapshot.alliance.name}</h3>
              {snapshot.alliance.description && (
                <p className="mt-1 text-sm text-[var(--muted)]">{snapshot.alliance.description}</p>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Rời khỏi liên minh này? Thủ lĩnh cần chuyển quyền trước khi rời.")) {
                  void runAction({ action: "leave" });
                }
              }}
              className="rounded-lg border border-rose-400/50 px-3 py-2 text-sm font-bold text-rose-600 disabled:opacity-50"
            >
              Rời liên minh
            </button>
          </div>

          <ul className="mt-3 divide-y divide-[var(--line)]">
            {snapshot.alliance.members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-[var(--navy)]">
                    {member.name}
                    {member.role === "LEADER" && (
                      <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">Thủ lĩnh</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--muted)]">@{member.username}</p>
                </div>
                {isLeader && member.role !== "LEADER" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Chuyển quyền thủ lĩnh cho ${member.name}?`)) {
                          void runAction({ action: "transfer", targetUserId: member.userId });
                        }
                      }}
                      className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] disabled:opacity-50"
                    >
                      Chuyển thủ lĩnh
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Loại ${member.name} khỏi liên minh?`)) {
                          void runAction({ action: "kick", targetUserId: member.userId });
                        }
                      }}
                      className="rounded-md border border-rose-400/40 px-2.5 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"
                    >
                      Loại
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={createAlliance} className="space-y-3 rounded-xl border border-[var(--line)] p-4">
            <h3 className="font-bold text-[var(--navy)]">Thành lập liên minh</h3>
            <label className="block text-xs text-[var(--muted)]">
              Tên liên minh
              <input
                required
                minLength={3}
                maxLength={32}
                name="name"
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Tag (2–5 chữ/số)
              <input
                required
                minLength={2}
                maxLength={5}
                pattern="[A-Za-z0-9]{2,5}"
                name="tag"
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm uppercase text-[var(--ink)]"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Mô tả (không bắt buộc)
              <textarea
                maxLength={240}
                name="description"
                rows={2}
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Đang xử lý…" : "Tạo liên minh"}
            </button>
          </form>

          <div>
            <h3 className="mb-2 font-bold text-[var(--navy)]">Liên minh đang tuyển thành viên</h3>
            {snapshot?.directory.length ? (
              <ul className="space-y-2">
                {snapshot.directory.map((alliance) => (
                  <li key={alliance.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--navy)]">[{alliance.tag}] {alliance.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {alliance.memberCount}/{snapshot.memberLimit} · Thủ lĩnh: {alliance.leaderName}
                      </p>
                      {alliance.description && <p className="mt-1 truncate text-xs text-[var(--muted)]">{alliance.description}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={busy || alliance.memberCount >= snapshot.memberLimit}
                      onClick={() => void runAction({ action: "join", allianceId: alliance.id })}
                      className="shrink-0 rounded-lg border border-[var(--teal)] px-3 py-2 text-xs font-bold text-[var(--teal)] disabled:opacity-50"
                    >
                      Gia nhập
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                Chưa có liên minh đang tuyển. Bạn có thể lập liên minh mới.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
