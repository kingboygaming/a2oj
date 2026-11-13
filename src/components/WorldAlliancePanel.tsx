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
    leaderUserId: string;
  }>;
  memberLimit: number;
  wars: Array<{
    id: string;
    status: string;
    challengerAllianceId: string;
    defenderAllianceId: string;
    challenger: { id: string; name: string; tag: string };
    defender: { id: string; name: string; tag: string };
    challengerScore: number;
    defenderScore: number;
    createdAt: string;
    startedAt: string;
    endsAt: string | null;
    completedAt: string | null;
    winnerAllianceId: string | null;
    leaderboard: Array<{ allianceId: string; name: string; score: number }>;
  }>;
  army: null | {
    infantry: number;
    archers: number;
    cavalry: number;
    training: boolean;
    marching: boolean;
  };
};

type AllianceAction =
  | { action: "create"; name: string; tag: string; description: string }
  | { action: "join"; allianceId: string }
  | { action: "leave" }
  | { action: "kick"; targetUserId: string }
  | { action: "transfer"; targetUserId: string }
  | { action: "challenge"; defenderAllianceId: string }
  | { action: "attackWar"; warId: string; infantry: number; archers: number; cavalry: number };

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
  const [attackCounts, setAttackCounts] = useState({ infantry: 0, archers: 0, cavalry: 0 });
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

  function warStatusLabel(status: string) {
    if (status === "ACTIVE") return "Đang chiến đấu";
    if (status === "COMPLETED") return "Đã kết thúc";
    return status;
  }

  function utcLabel(value: string | null) {
    return value ? `${value.slice(0, 16).replace("T", " ")} UTC` : "—";
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
            <h3 className="mb-2 font-bold text-[var(--navy)]">Liên minh công khai</h3>
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
                      {alliance.memberCount >= snapshot.memberLimit ? "Đã đủ người" : "Gia nhập"}
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

      {snapshot?.alliance && (
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <div className="mb-3">
            <h3 className="font-bold text-[var(--navy)]">⚔️ Alliance War</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Khi thủ lĩnh gửi thông báo khiêu chiến, trận bắt đầu ngay trong 24 giờ, không cần đối thủ chấp nhận. Mỗi đợt tối đa 500 quân, hồi lượt sau 60 giây và chịu 10% thương vong.
            </p>
          </div>

          {isLeader && snapshot.directory.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--navy)]">Thách chiến:</span>
              {snapshot.directory.map((alliance) => (
                <button
                  key={alliance.id}
                  type="button"
                  disabled={busy || snapshot.wars.some((war) =>
                    war.status === "ACTIVE" &&
                    (war.challengerAllianceId === snapshot.alliance?.id || war.defenderAllianceId === snapshot.alliance?.id),
                  )}
                  onClick={() => {
                    if (window.confirm(`Gửi thông báo khiêu chiến đến [${alliance.tag}] ${alliance.name}? Trận sẽ bắt đầu ngay trong 24 giờ, không cần đối thủ chấp nhận.`)) {
                      void runAction({ action: "challenge", defenderAllianceId: alliance.id });
                    }
                  }}
                  className="rounded-md border border-rose-400/40 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40"
                >
                  [{alliance.tag}] {alliance.name}
                </button>
              ))}
            </div>
          )}

          {snapshot.wars.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Chưa có trận chiến nào gần đây.</p>
          ) : (
            <div className="space-y-3">
              {snapshot.wars.map((war) => {
                const isChallenger = war.challengerAllianceId === snapshot.alliance?.id;
                const opponent = isChallenger ? war.defender : war.challenger;
                const myAllianceScore = isChallenger ? war.challengerScore : war.defenderScore;
                const opponentScore = isChallenger ? war.defenderScore : war.challengerScore;
                const isActive = war.status === "ACTIVE" && Boolean(war.endsAt) && new Date(war.endsAt!) > new Date();
                return (
                  <article key={war.id} className="rounded-xl border border-[var(--line)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">{warStatusLabel(war.status)}</p>
                        <h4 className="mt-1 font-bold text-[var(--navy)]">
                          [{opponent.tag}] {opponent.name}
                        </h4>
                        {war.status === "ACTIVE" && (
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            Kết thúc: {utcLabel(war.endsAt)}
                          </p>
                        )}
                        {war.status === "ACTIVE" && (
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {isChallenger
                              ? `Đã gửi thông báo khiêu chiến; trận bắt đầu ngay lúc ${utcLabel(war.startedAt)}.`
                              : `Liên minh của bạn đã nhận thông báo khiêu chiến; trận bắt đầu ngay lúc ${utcLabel(war.startedAt)}.`}
                          </p>
                        )}
                        {war.status === "COMPLETED" && (
                          <p className="mt-1 text-sm font-semibold text-[var(--navy)]">
                            {war.winnerAllianceId === null
                              ? "Hòa"
                              : war.winnerAllianceId === snapshot.alliance?.id
                                ? "Liên minh của bạn chiến thắng!"
                                : "Đối thủ chiến thắng."}
                          </p>
                        )}
                      </div>
                    </div>

                    {(war.status === "ACTIVE" || war.status === "COMPLETED") && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-[var(--teal)]/5 p-3">
                            <p className="text-xs text-[var(--muted)]">Liên minh của bạn</p>
                            <p className="font-black text-[var(--navy)]">{myAllianceScore.toLocaleString("vi-VN")}</p>
                          </div>
                          <div className="rounded-lg bg-rose-400/5 p-3">
                            <p className="text-xs text-[var(--muted)]">[{opponent.tag}] {opponent.name}</p>
                            <p className="font-black text-[var(--navy)]">{opponentScore.toLocaleString("vi-VN")}</p>
                          </div>
                        </div>
                        {war.leaderboard.length > 0 && (
                          <ol className="mt-3 grid gap-1 sm:grid-cols-2">
                            {war.leaderboard.slice(0, 6).map((player, index) => (
                              <li key={`${war.id}-${player.allianceId}-${player.name}`} className="flex justify-between gap-2 text-xs text-[var(--muted)]">
                                <span>{index + 1}. {player.name} · [{player.allianceId === war.challengerAllianceId ? war.challenger.tag : war.defender.tag}]</span>
                                <span className="font-bold text-[var(--navy)]">{player.score.toLocaleString("vi-VN")}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </>
                    )}

                    {isActive && (
                      <div className="mt-4 rounded-lg border border-[var(--line)] p-3">
                        <p className="text-sm font-bold text-[var(--navy)]">Gửi một đợt tấn công</p>
                        {snapshot.army?.training || snapshot.army?.marching ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">Cần hoàn tất huấn luyện và chờ quân đang hành quân trở về.</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            {([
                              ["infantry", "Bộ binh", snapshot.army?.infantry ?? 0],
                              ["archers", "Cung thủ", snapshot.army?.archers ?? 0],
                              ["cavalry", "Kỵ binh", snapshot.army?.cavalry ?? 0],
                            ] as const).map(([key, label, available]) => (
                              <label key={key} className="text-xs text-[var(--muted)]">
                                {label} (có {available})
                                <input
                                  type="number"
                                  min={0}
                                  max={Math.min(500, available)}
                                  value={attackCounts[key]}
                                  onChange={(event) => setAttackCounts((counts) => ({
                                    ...counts,
                                    [key]: Math.max(0, Number(event.target.value) || 0),
                                  }))}
                                  className="mt-1 block w-24 rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--ink)]"
                                />
                              </label>
                            ))}
                            <button
                              type="button"
                              disabled={busy || attackCounts.infantry + attackCounts.archers + attackCounts.cavalry < 1}
                              onClick={() => void runAction({
                                action: "attackWar",
                                warId: war.id,
                                ...attackCounts,
                              })}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {busy ? "Đang xử lý…" : "Tấn công"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
