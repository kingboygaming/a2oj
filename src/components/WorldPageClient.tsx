"use client";

import { useState } from "react";
import { WorldAlliancePanel } from "@/components/WorldAlliancePanel";
import type { WorldSnapshot } from "@/lib/world";

type ActionRequest =
  | { type: "join"; eventId: string }
  | { type: "contribute"; eventId: string }
  | { type: "claim"; eventId: string }
  | { type: "upgrade"; building: "FACTORY" | "WAREHOUSE" }
  | { type: "train"; troopType: "INFANTRY" | "ARCHERS" | "CAVALRY"; count: number }
  | { type: "dispatch"; eventId: string; infantry: number; archers: number; cavalry: number };

function utcLabel(value: string) {
  return `${value.slice(0, 16).replace("T", " ")} UTC`;
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function WorldPageClient({ initialSnapshot }: { initialSnapshot: WorldSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [trainingCount, setTrainingCount] = useState(10);
  const [marchArmy, setMarchArmy] = useState({ infantry: 0, archers: 0, cavalry: 0 });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function refresh() {
    const response = await fetch("/api/world", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Không thể tải trạng thái thế giới.");
    setSnapshot(result as WorldSnapshot);
  }

  async function act(key: string, action: ActionRequest) {
    setBusy(key);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/world/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể thực hiện thao tác.");
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.");
    } finally {
      setBusy("");
    }
  }

  const factoryCost = {
    wood: (snapshot.base.factoryLevel + 1) * 100,
    stone: (snapshot.base.factoryLevel + 1) * 50,
  };
  const warehouseCost = {
    wood: (snapshot.base.warehouseLevel + 1) * 150,
    stone: (snapshot.base.warehouseLevel + 1) * 100,
  };
  const upgrading = snapshot.base.upgradeType !== null;
  const activeMarch = snapshot.events.find((event) => event.activeMarch)?.activeMarch ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal)]">A2OJ · Giải trí</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--navy)]">Thế giới</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Căn cứ vẫn sản xuất khi bạn offline. Tiến độ được tính từ timestamp phía máy chủ, tối đa 48 giờ mỗi lần cập nhật.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh().catch((error: unknown) => {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : "Không thể làm mới thế giới.");
          })}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--paper)]"
        >
          Làm mới
        </button>
      </header>

      {message && (
        <p role={isError ? "alert" : "status"} className={`mb-4 rounded-lg border p-3 text-sm ${isError ? "border-rose-400/40 bg-rose-400/10 text-rose-700" : "border-emerald-500/30 bg-emerald-500/10 text-[var(--navy)]"}`}>
          {message}
        </p>
      )}

      {(snapshot.offline.elapsedSeconds > 60 || snapshot.offline.cappedOfflineTime) && (
        <section className="mb-5 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 p-4 text-sm text-[var(--navy)]">
          <h2 className="font-bold">Báo cáo hoạt động offline</h2>
          <p className="mt-1 text-[var(--muted)]">
            Đã tính {formatElapsed(snapshot.offline.elapsedSeconds)}: +{snapshot.offline.producedWood} gỗ, +{snapshot.offline.producedStone} đá.
            {snapshot.offline.cappedOfflineTime && " Thời gian vượt giới hạn 48 giờ không được tích trữ."}
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-amber-500/20 bg-[var(--paper)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">🪵 Gỗ</p>
          <p className="mt-1 text-3xl font-black text-[var(--navy)]">{snapshot.base.wood.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">+{snapshot.base.woodPerHour}/giờ · kho tối đa {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
        </article>
        <article className="rounded-2xl border border-slate-400/30 bg-[var(--paper)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">🪨 Đá</p>
          <p className="mt-1 text-3xl font-black text-[var(--navy)]">{snapshot.base.stone.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">+{snapshot.base.stonePerHour}/giờ · kho tối đa {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
        </article>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Tọa độ căn cứ · X/Z</p>
        <p className="mt-1 font-mono text-sm font-semibold text-[var(--navy)]">
          X: {(snapshot.base.coordinateX / 1_000).toFixed(3)} km · Z: {(snapshot.base.coordinateZ / 1_000).toFixed(3)} km
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">Vị trí được cấp ngẫu nhiên; tâm mỗi căn cứ cách căn cứ khác tối thiểu 10 km.</p>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Nhà máy cấp {snapshot.base.factoryLevel}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Sản xuất gỗ và đá</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Nâng cấp tăng sản lượng mỗi giờ.</p>
            </div>
            <span className="text-2xl" aria-hidden="true">🏭</span>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || upgrading || snapshot.base.factoryLevel >= 20}
            onClick={() => void act("factory", { type: "upgrade", building: "FACTORY" })}
            className="mt-4 w-full rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "factory" ? "Đang xử lý…" : `Nâng cấp · ${factoryCost.wood} gỗ + ${factoryCost.stone} đá`}
          </button>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Kho cấp {snapshot.base.warehouseLevel}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Sức chứa tài nguyên</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Mỗi cấp tăng 2.000 sức chứa cho từng tài nguyên.</p>
            </div>
            <span className="text-2xl" aria-hidden="true">🏗️</span>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || upgrading || snapshot.base.warehouseLevel >= 20}
            onClick={() => void act("warehouse", { type: "upgrade", building: "WAREHOUSE" })}
            className="mt-4 w-full rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "warehouse" ? "Đang xử lý…" : `Nâng cấp · ${warehouseCost.wood} gỗ + ${warehouseCost.stone} đá`}
          </button>
        </article>
      </section>

      {upgrading && snapshot.base.upgradeCompletesAt && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-[var(--navy)]">
          Công trình đang nâng cấp; dự kiến hoàn tất lúc {utcLabel(snapshot.base.upgradeCompletesAt)}. Tiến độ vẫn chạy khi bạn offline.
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Quân đội</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Huấn luyện binh sĩ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Một hàng đợi huấn luyện tại một thời điểm. Quân hoàn thành theo giờ máy chủ.</p>
          </div>
          <label className="text-xs text-[var(--muted)]">
            Số lượng mỗi đợt
            <input
              type="number"
              min={1}
              max={100}
              value={trainingCount}
              onChange={(event) => setTrainingCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
              className="mt-1 block w-28 rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            { type: "INFANTRY", label: "Bộ binh", icon: "🛡️", count: snapshot.base.army.infantry, cost: "10 gỗ · 5 đá", damage: 10 },
            { type: "ARCHERS", label: "Cung thủ", icon: "🏹", count: snapshot.base.army.archers, cost: "15 gỗ · 5 đá", damage: 15 },
            { type: "CAVALRY", label: "Kỵ binh", icon: "🐎", count: snapshot.base.army.cavalry, cost: "20 gỗ · 10 đá", damage: 20 },
          ] as const).map((troop) => (
            <article key={troop.type} className="rounded-xl border border-[var(--line)] p-4">
              <p className="text-sm font-bold text-[var(--navy)]">{troop.icon} {troop.label}</p>
              <p className="mt-1 text-lg font-black text-[var(--navy)]">{troop.count.toLocaleString("vi-VN")} quân</p>
              <p className="text-xs text-[var(--muted)]">{troop.cost}/lính · {troop.damage} sát thương/lính</p>
              <button
                type="button"
                disabled={Boolean(busy) || Boolean(snapshot.base.army.trainingType)}
                onClick={() => void act(`train-${troop.type}`, {
                  type: "train",
                  troopType: troop.type,
                  count: trainingCount,
                })}
                className="mt-3 w-full rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:opacity-50"
              >
                {busy === `train-${troop.type}` ? "Đang xếp hàng…" : `Huấn luyện ${trainingCount}`}
              </button>
            </article>
          ))}
        </div>
        {snapshot.base.army.trainingType && snapshot.base.army.trainingCompletesAt && (
          <p className="mt-3 rounded-lg bg-[var(--teal)]/5 px-3 py-2 text-sm text-[var(--navy)]">
            Đang huấn luyện {snapshot.base.army.trainingCount} {snapshot.base.army.trainingType === "INFANTRY" ? "bộ binh" : snapshot.base.army.trainingType === "ARCHERS" ? "cung thủ" : "kỵ binh"}; hoàn tất lúc {utcLabel(snapshot.base.army.trainingCompletesAt)}.
          </p>
        )}
        {activeMarch && (
          <p className="mt-3 rounded-lg bg-rose-400/5 px-3 py-2 text-sm text-[var(--navy)]">
            {activeMarch.status === "RETURNING" ? "Quân đang trở về từ" : "Quân đang hành quân tới"} {activeMarch.eventTitle}.
            {activeMarch.status === "RETURNING" && ` Sát thương ${activeMarch.damage.toLocaleString("vi-VN")}, tổn thất ${activeMarch.casualties} quân.`}
            {" "}{activeMarch.status === "RETURNING" && activeMarch.returnsAt
              ? `Dự kiến về lúc ${utcLabel(activeMarch.returnsAt)}.`
              : `Dự kiến tới lúc ${utcLabel(activeMarch.arrivesAt)}.`}
          </p>
        )}
      </section>

      <WorldAlliancePanel />

      {snapshot.pendingRewards.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-bold text-[var(--navy)]">🎁 Thưởng chưa nhận</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.pendingRewards.map((reward) => (
              <article key={reward.eventId} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <h3 className="font-bold text-[var(--navy)]">{reward.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{reward.wood} gỗ · {reward.stone} đá</p>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void act(`claim-${reward.eventId}`, { type: "claim", eventId: reward.eventId })}
                  className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy === `claim-${reward.eventId}` ? "Đang nhận…" : "Nhận thưởng"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-3">
          <h2 className="text-xl font-bold text-[var(--navy)]">📅 Sự kiện thế giới</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Sự kiện có lịch, điều kiện tham gia và phần thưởng theo thứ hạng.</p>
        </div>
        <div className="space-y-4">
          {snapshot.events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">
                    {event.status === "ACTIVE" ? "Đang diễn ra" : event.status === "SCHEDULED" ? "Sắp diễn ra" : event.status === "PROCESSING" ? "Đang tổng kết" : event.status === "CANCELED" ? "Đã hủy" : "Đã kết thúc"}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--navy)]">{event.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{event.description}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {utcLabel(event.startsAt)} – {utcLabel(event.endsAt)} · {event.participantCount}/{event.participantLimit} người
                    {event.joined && ` · Điểm của bạn: ${event.score}${event.rank ? ` · Hạng ${event.rank}` : ""}`}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Điều kiện: nhà máy cấp {event.minFactoryLevel}+ · đóng góp {event.contributionWoodCost} gỗ/lượt · cooldown {event.contributionCooldownSeconds}s
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Thưởng: {event.rewards.map((reward, index) => `H${index + 1} ${reward.wood} gỗ/${reward.stone} đá`).join(" · ")}
                  </p>
                  {event.eventType === "WORLD_BOSS" && (
                    <div className="mt-3 max-w-xl">
                      <div className="flex justify-between gap-2 text-xs font-semibold text-[var(--navy)]">
                        <span>🐲 Boss toàn server</span>
                        <span>{event.bossHpRemaining.toLocaleString("vi-VN")} / {event.bossHp.toLocaleString("vi-VN")} HP</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Máu boss"
                        aria-valuemin={0}
                        aria-valuemax={event.bossHp}
                        aria-valuenow={event.bossHpRemaining}
                        className="mt-1 h-3 overflow-hidden rounded-full bg-rose-950/20"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-600 to-orange-400 transition-[width]"
                          style={{ width: `${event.bossHp > 0 ? Math.max(0, Math.min(100, event.bossHpRemaining / event.bossHp * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {event.status === "ACTIVE" && (
                  <div className="flex gap-2">
                    {!event.joined && (
                      <button
                        type="button"
                        disabled={Boolean(busy) || event.participantCount >= event.participantLimit || snapshot.base.factoryLevel < event.minFactoryLevel}
                        onClick={() => void act(`join-${event.id}`, { type: "join", eventId: event.id })}
                        className="rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:opacity-50"
                      >
                        {busy === `join-${event.id}` ? "Đang vào…" : snapshot.base.factoryLevel < event.minFactoryLevel ? `Cần nhà máy cấp ${event.minFactoryLevel}` : "Tham gia"}
                      </button>
                    )}
                    {event.joined && event.eventType === "RESOURCE_RUSH" && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act(`contribute-${event.id}`, { type: "contribute", eventId: event.id })}
                        className="rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy === `contribute-${event.id}` ? "Đang gửi…" : `Đóng góp ${event.contributionWoodCost} gỗ`}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {event.status === "ACTIVE" && event.joined && event.eventType === "WORLD_BOSS" && (
                <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
                  {event.activeMarch ? (
                    <div className="text-sm text-[var(--navy)]">
                      <p className="font-bold">
                        {event.activeMarch.status === "RETURNING" ? "Đạo quân đang trở về căn cứ" : "Đạo quân đang hành quân"}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        {event.activeMarch.infantry} bộ binh · {event.activeMarch.archers} cung thủ · {event.activeMarch.cavalry} kỵ binh
                        {event.activeMarch.status === "RETURNING" && ` · Gây ${event.activeMarch.damage.toLocaleString("vi-VN")} sát thương · Mất ${event.activeMarch.casualties} quân`}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {event.activeMarch.status === "RETURNING" && event.activeMarch.returnsAt
                          ? `Dự kiến về lúc ${utcLabel(event.activeMarch.returnsAt)}`
                          : `Dự kiến tới lúc ${utcLabel(event.activeMarch.arrivesAt)}`}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[var(--navy)]">Điều quân đánh boss</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Tối đa 500 quân mỗi đạo. Sát thương được tính khi đến nơi; 10% quân số hy sinh và phần còn lại quay về.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {([
                          ["infantry", "Bộ binh", snapshot.base.army.infantry],
                          ["archers", "Cung thủ", snapshot.base.army.archers],
                          ["cavalry", "Kỵ binh", snapshot.base.army.cavalry],
                        ] as const).map(([field, label, available]) => (
                          <label key={field} className="text-xs text-[var(--muted)]">
                            {label} · có {available}
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={marchArmy[field]}
                              onChange={(inputEvent) => setMarchArmy((current) => ({
                                ...current,
                                [field]: Math.max(0, Math.min(available, Number(inputEvent.target.value) || 0)),
                              }))}
                              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy) || snapshot.base.army.trainingType !== null || Object.values(marchArmy).reduce((sum, count) => sum + count, 0) === 0 || Object.values(marchArmy).reduce((sum, count) => sum + count, 0) > 500}
                        onClick={() => void act(`march-${event.id}`, {
                          type: "dispatch",
                          eventId: event.id,
                          ...marchArmy,
                        })}
                        className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === `march-${event.id}` ? "Đang điều quân…" : "Cử quân đi đánh"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {event.leaderboard.length > 0 && (
                <ol className="mt-4 grid gap-1 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
                  {event.leaderboard.slice(0, 10).map((player, index) => (
                    <li key={`${event.id}-${index}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm text-[var(--navy)]">
                      <span className="truncate">{index + 1}. {player.name}</span>
                      <span className="shrink-0 font-bold">
                        {player.score.toLocaleString("vi-VN")} {event.eventType === "WORLD_BOSS" ? "sát thương" : "điểm"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {event.status === "COMPLETED" && event.joined && event.rank && event.rank <= 3 && (
                <p className="mt-3 text-sm font-semibold text-amber-700">Bạn đạt hạng thưởng. Phần thưởng được lưu trong mục “Thưởng chưa nhận”.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
