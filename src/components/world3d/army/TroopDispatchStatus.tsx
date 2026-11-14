"use client";

import { useState, useMemo } from "react";
import type { WorldMapMissionView, WorldSnapshot } from "@/lib/world";
import { resourceKindLabel, type WorldMapObject } from "@/lib/world-map-objects";
import { worldMilitaryTierName } from "@/lib/world-research";

export interface TroopDispatchStatusProps {
  userId: string;
  playerCoordinateX?: number | null;
  playerCoordinateZ?: number | null;
  mapMissions: WorldMapMissionView[];
  baseAttacks: WorldSnapshot["baseAttacks"];
  mapObjectDefinitions?: WorldMapObject[];
  nowMs: number;
  onLocate?: (worldX: number, worldZ: number, targetId?: string, isBase?: boolean) => void;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}p ${seconds}s`;
  return `${seconds}s`;
}

function getProgressPercent(startIso?: string | null, endIso?: string | null, nowMs: number = Date.now()): number {
  if (!startIso || !endIso) return 50;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (end <= start) return 100;
  const elapsed = nowMs - start;
  const total = end - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function TroopDispatchStatus({
  userId,
  playerCoordinateX = 0,
  playerCoordinateZ = 0,
  mapMissions = [],
  baseAttacks = [],
  mapObjectDefinitions = [],
  nowMs,
  onLocate,
}: TroopDispatchStatusProps) {
  const [filter, setFilter] = useState<"ALL" | "ROGUE_CAMP" | "BASE_ATTACK" | "RESOURCE">("ALL");
  const [viewSection, setViewSection] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  const mapObjectMap = useMemo(() => {
    return new Map(mapObjectDefinitions.map((d) => [d.id, d]));
  }, [mapObjectDefinitions]);

  // Separate active vs completed/resolved missions
  const activeMissions = useMemo(() => {
    return mapMissions.filter(
      (m) => m.status === "IN_TRANSIT" || m.status === "RESOLVING" || m.status === "RETURNING" || m.status === "GARRISONED" || m.status === "OCCUPYING",
    );
  }, [mapMissions]);

  const pastMissions = useMemo(() => {
    return mapMissions.filter((m) => m.status === "COMPLETED" || m.status === "RESOLVED" || m.status === "RETURNED");
  }, [mapMissions]);

  const activeBaseAttacks = useMemo(() => {
    return baseAttacks.filter((a) => a.status === "IN_TRANSIT" || a.status === "RESOLVING");
  }, [baseAttacks]);

  const pastBaseAttacks = useMemo(() => {
    return baseAttacks.filter((a) => a.status === "RESOLVED");
  }, [baseAttacks]);

  // Incoming attacks on current user's base
  const incomingAttacks = useMemo(() => {
    return activeBaseAttacks.filter((a) => a.defenderUserId === userId);
  }, [activeBaseAttacks, userId]);

  // Outgoing attacks
  const outgoingBaseAttacks = useMemo(() => {
    return activeBaseAttacks.filter((a) => a.attackerUserId === userId);
  }, [activeBaseAttacks, userId]);

  // Filtered active lists
  const filteredActiveMissions = useMemo(() => {
    if (filter === "ROGUE_CAMP") {
      return activeMissions.filter((m) => m.targetKind === "ROGUE_CAMP");
    }
    if (filter === "RESOURCE") {
      return activeMissions.filter((m) => m.targetKind === "RESOURCE");
    }
    if (filter === "BASE_ATTACK") {
      return [];
    }
    return activeMissions;
  }, [activeMissions, filter]);

  const showBaseAttacks = filter === "ALL" || filter === "BASE_ATTACK";

  const totalActiveCount = activeMissions.length + activeBaseAttacks.length;
  const campCount = activeMissions.filter((m) => m.targetKind === "ROGUE_CAMP").length;
  const resourceCount = activeMissions.filter((m) => m.targetKind === "RESOURCE").length;
  const attackCount = activeBaseAttacks.length;

  return (
    <div className="space-y-3.5">
      {/* ── Incoming Attack Warning Banner ── */}
      {incomingAttacks.length > 0 && (
        <div className="animate-pulse rounded-xl border border-red-500/80 bg-gradient-to-r from-red-950/90 via-red-900/80 to-black/90 p-3.5 text-xs text-red-100 shadow-xl shadow-red-950/60 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚨</span>
            <div>
              <p className="font-extrabold uppercase tracking-wider text-red-300">
                Cảnh báo nguy cấp: Địch đang hành quân tấn công!
              </p>
              <p className="text-[11px] text-red-200/80">
                Có {incomingAttacks.length} đạo quân đối phương đang tiến thẳng vào thành trì của bạn.
              </p>
            </div>
          </div>
          {incomingAttacks.map((attack) => {
            const remSec = Math.max(0, Math.ceil((new Date(attack.arrivesAt).getTime() - nowMs) / 1000));
            return (
              <div key={attack.id} className="rounded-lg border border-red-500/40 bg-black/50 p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between items-center font-bold text-white">
                  <span>⚔️ Kẻ xâm lăng: {attack.attackerName}</span>
                  <span className="font-mono text-red-300 bg-red-950/70 px-2 py-0.5 rounded border border-red-500/30">
                    Đến sau: {formatDuration(remSec)}
                  </span>
                </div>
                <p className="text-white/70">
                  Khoảng cách: {(attack.distanceMeters / 1000).toFixed(1)} km · Dự kiến đến: {new Date(attack.arrivesAt).toLocaleTimeString("vi-VN")}
                </p>
                <p className="text-amber-300 text-[10px]">
                  💡 Gợi ý: Hãy huấn luyện thêm quân phòng thủ hoặc kích hoạt khiên bảo hộ kịp thời!
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section Header with Active vs History Toggle ── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
            Trạng thái điều quân & Chiến trận
          </h3>
          <p className="text-[10px] text-white/50">
            Theo dõi quân lâu la, đánh căn cứ đối thủ và khai thác tài nguyên
          </p>
        </div>
        <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setViewSection("ACTIVE")}
            className={`rounded-md px-2 py-1 font-bold transition ${
              viewSection === "ACTIVE"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            Đang xuất trận ({totalActiveCount})
          </button>
          <button
            type="button"
            onClick={() => setViewSection("HISTORY")}
            className={`rounded-md px-2 py-1 font-bold transition ${
              viewSection === "HISTORY"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            Chiến báo ({pastMissions.length + pastBaseAttacks.length})
          </button>
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`rounded-lg px-2.5 py-1 font-semibold transition border ${
            filter === "ALL"
              ? "border-teal-400/50 bg-teal-500/20 text-teal-300"
              : "border-white/10 bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          Tất cả ({viewSection === "ACTIVE" ? totalActiveCount : pastMissions.length + pastBaseAttacks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("ROGUE_CAMP")}
          className={`rounded-lg px-2.5 py-1 font-semibold transition border ${
            filter === "ROGUE_CAMP"
              ? "border-rose-400/50 bg-rose-500/20 text-rose-300"
              : "border-white/10 bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          👹 Đánh quái ({viewSection === "ACTIVE" ? campCount : pastMissions.filter((m) => m.targetKind === "ROGUE_CAMP").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("BASE_ATTACK")}
          className={`rounded-lg px-2.5 py-1 font-semibold transition border ${
            filter === "BASE_ATTACK"
              ? "border-orange-400/50 bg-orange-500/20 text-orange-300"
              : "border-white/10 bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          ⚔️ Đánh base ({viewSection === "ACTIVE" ? attackCount : pastBaseAttacks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("RESOURCE")}
          className={`rounded-lg px-2.5 py-1 font-semibold transition border ${
            filter === "RESOURCE"
              ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
              : "border-white/10 bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          ⛏️ Khai thác ({viewSection === "ACTIVE" ? resourceCount : pastMissions.filter((m) => m.targetKind === "RESOURCE").length})
        </button>
      </div>

      {/* ── Active Missions Section ── */}
      {viewSection === "ACTIVE" && (
        <div className="space-y-3">
          {totalActiveCount === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-white/50">
              <span className="text-2xl">🏕️</span>
              <p className="mt-2 font-semibold text-white/70">Không có đội quân nào đang xuất trận</p>
              <p className="mt-1 text-[11px] text-white/40">
                Hãy chuyển sang góc nhìn Bản đồ Thế giới để cử quân đánh quái lâu la, chiếm mỏ tài nguyên hoặc tấn công căn cứ người chơi khác.
              </p>
            </div>
          )}

          {/* 1. Outgoing Base Attacks */}
          {showBaseAttacks &&
            outgoingBaseAttacks.map((attack) => {
              const remSec = Math.max(0, Math.ceil((new Date(attack.arrivesAt).getTime() - nowMs) / 1000));
              const percent = getProgressPercent(attack.dispatchedAt, attack.arrivesAt, nowMs);
              const totalTroops = attack.infantry + attack.archers + attack.cavalry;

              return (
                <div
                  key={attack.id}
                  className="rounded-xl border border-orange-500/40 bg-gradient-to-br from-orange-950/40 via-black/60 to-black/80 p-3 text-xs text-white shadow-lg space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-300 border border-orange-400/30">
                          ⚔️ Đánh căn cứ đối thủ
                        </span>
                        <span className="text-[10px] text-white/50">{(attack.distanceMeters / 1000).toFixed(1)} km</span>
                      </div>
                      <h4 className="mt-1 font-bold text-sm text-white">
                        Mục tiêu: Căn cứ của {attack.defenderName}
                      </h4>
                    </div>
                    <span className="font-mono text-xs font-bold text-orange-300 bg-orange-950/80 px-2 py-1 rounded border border-orange-500/30">
                      {remSec > 0 ? formatDuration(remSec) : "Đang giao chiến…"}
                    </span>
                  </div>

                  {/* Troop Composition */}
                  <div className="flex flex-wrap gap-2 text-[10px] text-white/80 bg-white/5 p-2 rounded-lg border border-white/5">
                    <span>Quân viễn chinh ({totalTroops}):</span>
                    <span>🛡️ {attack.infantry} Bộ binh</span>
                    <span>🏹 {attack.archers} Cung thủ</span>
                    <span>🐎 {attack.cavalry} Kỵ binh</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-orange-200/80 font-medium">
                      <span>Đang hành quân công thành</span>
                      <span>{percent}% (Đến lúc {new Date(attack.arrivesAt).toLocaleTimeString("vi-VN")})</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

          {/* 2. Map Missions (Rogue camps & Resource nodes) */}
          {filteredActiveMissions.map((mission) => {
            const def = mapObjectMap.get(mission.targetId);
            const isCamp = mission.targetKind === "ROGUE_CAMP";
            const targetName = def?.name ?? (isCamp ? `Trại lưu khấu #${mission.targetId}` : `Khu tài nguyên #${mission.targetId}`);
            const totalTroops = mission.infantry + mission.archers + mission.cavalry;
            const targetX = def?.x ?? 0;
            const targetZ = def?.z ?? 0;
            const distanceMeters = Math.round(
              Math.hypot(targetX - (playerCoordinateX ?? 0), targetZ - (playerCoordinateZ ?? 0)),
            );

            const isReturning = mission.status === "RETURNING";
            const isGarrisoned = mission.status === "GARRISONED" || mission.status === "OCCUPYING";
            const isResolving = mission.status === "RESOLVING";

            const targetTimeIso = isReturning ? mission.returnsAt : mission.arrivesAt;
            const remSec = targetTimeIso
              ? Math.max(0, Math.ceil((new Date(targetTimeIso).getTime() - nowMs) / 1000))
              : 0;

            const percent = isReturning
              ? getProgressPercent(mission.arrivesAt, mission.returnsAt, nowMs)
              : getProgressPercent(mission.dispatchedAt, mission.arrivesAt, nowMs);

            return (
              <div
                key={mission.id}
                className={`rounded-xl border p-3 text-xs text-white shadow-lg space-y-2.5 ${
                  isCamp
                    ? "border-rose-500/40 bg-gradient-to-br from-rose-950/40 via-black/60 to-black/80"
                    : "border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-black/60 to-black/80"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                          isCamp
                            ? "bg-rose-500/30 text-rose-300 border-rose-400/30"
                            : "bg-amber-500/30 text-amber-300 border-amber-400/30"
                        }`}
                      >
                        {isCamp ? "👹 Đánh quân lâu la" : "⛏️ Khai thác tài nguyên"}
                      </span>
                      {def && "level" in def && (
                        <span className="text-[10px] text-white/60">Cấp {def.level}</span>
                      )}
                      <span className="text-[10px] text-white/50">{(distanceMeters / 1000).toFixed(1)} km</span>
                    </div>
                    <h4 className="mt-1 font-bold text-sm text-white flex items-center gap-1.5">
                      <span>{targetName}</span>
                    </h4>
                    {def?.kind === "RESOURCE" && (
                      <p className="text-[10px] text-amber-200/70">
                        {resourceKindLabel(def.resource)} · Sản lượng: +{def.yieldPerMinute}/phút
                      </p>
                    )}
                    {def?.kind === "ROGUE_CAMP" && (
                      <p className="text-[10px] text-rose-200/70">
                        Quái: {def.monsterType} · Chiến lực yêu cầu: {def.combatPower.toLocaleString("vi-VN")}
                      </p>
                    )}
                  </div>

                  {/* Countdown Badge */}
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-1 rounded border ${
                        isReturning
                          ? "bg-sky-950/80 text-sky-300 border-sky-400/40"
                          : isGarrisoned
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-400/40"
                          : isCamp
                          ? "bg-rose-950/80 text-rose-300 border-rose-400/40"
                          : "bg-amber-950/80 text-amber-300 border-amber-400/40"
                      }`}
                    >
                      {isGarrisoned
                        ? "Đang đồn trú"
                        : remSec > 0
                        ? formatDuration(remSec)
                        : "Đang hoàn tất…"}
                    </span>
                    {onLocate && def && (
                      <button
                        type="button"
                        onClick={() => onLocate(def.x, def.z, def.id, false)}
                        className="mt-1.5 text-[10px] text-teal-300/80 hover:text-teal-200 underline flex items-center gap-0.5"
                      >
                        <span>📍 Vị trí</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Army Troops */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-white/5 p-2 rounded-lg border border-white/5 text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Quân ({totalTroops}):</span>
                    <span>🛡️ {mission.infantry}</span>
                    <span>🏹 {mission.archers}</span>
                    <span>🐎 {mission.cavalry}</span>
                  </div>
                  <span className="text-white/50">Bậc {worldMilitaryTierName(mission.troopTier)}</span>
                </div>

                {/* Status and Progress Bar */}
                {isGarrisoned ? (
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 p-2 text-[10px] text-emerald-200 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>⛏️ Đang khai thác & kiểm soát mỏ tài nguyên</span>
                      <span>+{def?.kind === "RESOURCE" ? def.yieldPerMinute : 0}/phút</span>
                    </div>
                    <p className="text-[10px] text-emerald-300/70">
                      Đạo quân đang giữ vững khu vực này. Bạn có thể thu hoạch sản lượng bất cứ lúc nào.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-white/70 font-medium">
                      <span>
                        {isReturning
                          ? "🏃 Đang rút quân về thành"
                          : isResolving
                          ? "⚔️ Đang giao chiến..."
                          : isCamp
                          ? "🚀 Đang hành quân đánh quái"
                          : "🚀 Đang hành quân chiếm mỏ"}
                      </span>
                      <span>
                        {targetTimeIso ? `${percent}% · Đến lúc ${new Date(targetTimeIso).toLocaleTimeString("vi-VN")}` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/60">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isReturning
                            ? "bg-gradient-to-r from-sky-400 to-indigo-400"
                            : isCamp
                            ? "bg-gradient-to-r from-rose-500 to-orange-400"
                            : "bg-gradient-to-r from-amber-500 to-emerald-400"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── History & Battle Reports Section ── */}
      {viewSection === "HISTORY" && (
        <div className="space-y-3">
          {pastMissions.length === 0 && pastBaseAttacks.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-white/50">
              <span className="text-2xl">📜</span>
              <p className="mt-2 font-semibold text-white/70">Chưa có chiến báo nào gần đây</p>
            </div>
          )}

          {/* Past Base Attacks */}
          {showBaseAttacks &&
            pastBaseAttacks.map((attack) => {
              const isAttacker = attack.attackerUserId === userId;
              const won = attack.winnerUserId === userId;
              return (
                <div
                  key={attack.id}
                  className={`rounded-xl border p-3 text-xs text-white space-y-2 ${
                    won ? "border-emerald-500/40 bg-emerald-950/20" : "border-rose-500/40 bg-rose-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            won ? "bg-emerald-500/30 text-emerald-300" : "bg-rose-500/30 text-rose-300"
                          }`}
                        >
                          {won ? "🏆 Thắng trận" : "💀 Thất bại"}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {isAttacker ? "Tấn công căn cứ" : "Phòng thủ căn cứ"}
                        </span>
                      </div>
                      <h4 className="mt-1 font-bold text-sm text-white">
                        {isAttacker ? `Công thành: ${attack.defenderName}` : `Bị tấn công bởi: ${attack.attackerName}`}
                      </h4>
                    </div>
                    {attack.resolvedAt && (
                      <span className="text-[10px] text-white/40">
                        {new Date(attack.resolvedAt).toLocaleTimeString("vi-VN")}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-white/80 bg-black/40 p-2 rounded-lg border border-white/5 space-y-1">
                    <p>
                      {isAttacker ? "Quân ta tổn thất" : "Tổn thất phòng thủ"}:{" "}
                      <span className="font-bold text-rose-300">{isAttacker ? attack.attackerCasualties : attack.defenderCasualties}</span> quân
                      {" · "}Đối phương mất:{" "}
                      <span className="font-bold text-amber-300">{isAttacker ? attack.defenderCasualties : attack.attackerCasualties}</span> quân
                    </p>
                    {(attack.stolenWood > 0 || attack.stolenStone > 0) && (
                      <p className="text-amber-200">
                        {won ? "Cướp được" : "Bị cướp"}: {attack.stolenWood} 🪵 gỗ, {attack.stolenStone} 🪨 đá
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Past Map Missions */}
          {pastMissions
            .filter((m) => {
              if (filter === "ROGUE_CAMP") return m.targetKind === "ROGUE_CAMP";
              if (filter === "RESOURCE") return m.targetKind === "RESOURCE";
              if (filter === "BASE_ATTACK") return false;
              return true;
            })
            .map((mission) => {
              const def = mapObjectMap.get(mission.targetId);
              const isCamp = mission.targetKind === "ROGUE_CAMP";
              const targetName = def?.name ?? (isCamp ? `Trại lưu khấu #${mission.targetId}` : `Khu tài nguyên #${mission.targetId}`);
              const won = (mission.report && mission.report.includes("Chiến thắng")) || mission.rewardExperience > 0;

              return (
                <div
                  key={mission.id}
                  className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            isCamp
                              ? won
                                ? "bg-emerald-500/30 text-emerald-300"
                                : "bg-rose-500/30 text-rose-300"
                              : "bg-amber-500/30 text-amber-300"
                          }`}
                        >
                          {isCamp ? (won ? "🏆 Thắng quái" : "💀 Thua trận") : "⛏️ Hoàn thành khai thác"}
                        </span>
                        <span className="text-[10px] text-white/50">{targetName}</span>
                      </div>
                    </div>
                    {mission.completedAt && (
                      <span className="text-[10px] text-white/40">
                        {new Date(mission.completedAt).toLocaleTimeString("vi-VN")}
                      </span>
                    )}
                  </div>

                  {mission.report && (
                    <p className="text-[11px] text-white/80 bg-white/5 p-2 rounded-lg border border-white/5">
                      {mission.report}
                    </p>
                  )}

                  {/* Rewards summary */}
                  {(mission.rewardWood > 0 ||
                    mission.rewardStone > 0 ||
                    mission.rewardIron > 0 ||
                    mission.rewardFood > 0 ||
                    mission.rewardExperience > 0 ||
                    mission.rewardRare > 0 ||
                    mission.rewardItemCount > 0) && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-amber-200 bg-amber-950/20 p-2 rounded-lg border border-amber-500/20">
                      <span className="font-bold text-white">Phần thưởng:</span>
                      {mission.rewardWood > 0 && <span>+{mission.rewardWood} 🪵 gỗ</span>}
                      {mission.rewardStone > 0 && <span>+{mission.rewardStone} 🪨 đá</span>}
                      {mission.rewardIron > 0 && <span>+{mission.rewardIron} ⛓️ sắt</span>}
                      {mission.rewardFood > 0 && <span>+{mission.rewardFood} 🌾 lương thực</span>}
                      {mission.rewardRare > 0 && <span>+{mission.rewardRare} 💎 hiếm</span>}
                      {mission.rewardExperience > 0 && <span>+{mission.rewardExperience} ⭐ EXP</span>}
                      {mission.rewardItemCount > 0 && (
                        <span>
                          +{mission.rewardItemCount} 🎒 {mission.rewardItemKey}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive floating widget for top HUD overlay
 * Shows compact badges for active marches and alerts
 */
export function ActiveMarchesHud({
  userId,
  mapMissions = [],
  baseAttacks = [],
  nowMs,
  onOpenMarches,
}: {
  userId: string;
  mapMissions: WorldMapMissionView[];
  baseAttacks: WorldSnapshot["baseAttacks"];
  mapObjectDefinitions?: WorldMapObject[];
  nowMs: number;
  onOpenMarches: () => void;
}) {
  const activeMissions = useMemo(() => {
    return mapMissions.filter(
      (m) => m.status === "IN_TRANSIT" || m.status === "RESOLVING" || m.status === "RETURNING" || m.status === "GARRISONED" || m.status === "OCCUPYING",
    );
  }, [mapMissions]);

  const activeAttacks = useMemo(() => {
    return baseAttacks.filter((a) => a.status === "IN_TRANSIT" || a.status === "RESOLVING");
  }, [baseAttacks]);

  const incomingAttack = useMemo(() => {
    return activeAttacks.find((a) => a.defenderUserId === userId);
  }, [activeAttacks, userId]);

  if (activeMissions.length === 0 && activeAttacks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 pointer-events-auto">
      {/* High priority alert banner if under incoming attack */}
      {incomingAttack && (() => {
        const remSec = Math.max(0, Math.ceil((new Date(incomingAttack.arrivesAt).getTime() - nowMs) / 1000));
        return (
          <button
            type="button"
            onClick={onOpenMarches}
            className="animate-pulse flex items-center gap-2 rounded-xl border border-red-500/80 bg-red-950/90 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-lg shadow-red-950/60 hover:border-red-400 transition text-left"
          >
            <span className="text-base">🚨</span>
            <div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-extrabold uppercase text-red-300">Bị tấn công!</span>
                <span className="font-mono font-bold text-white bg-red-800/80 px-1 rounded">{formatDuration(remSec)}</span>
              </div>
              <p className="text-[10px] text-red-100 font-semibold">{incomingAttack.attackerName} đang đánh thành</p>
            </div>
          </button>
        );
      })()}

      {/* Quick March Badges List */}
      <div
        onClick={onOpenMarches}
        className="cursor-pointer flex items-center gap-2 rounded-xl border border-teal-500/30 bg-black/80 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-lg shadow-teal-950/30 hover:border-teal-400 transition"
      >
        <span className="text-base animate-bounce">⚔️</span>
        <div>
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="font-bold text-teal-300">
              {activeMissions.length + activeAttacks.length} đội quân đang xuất trận
            </span>
            <span className="text-white/40 text-[9px]">Xem chi tiết →</span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/80">
            {activeAttacks.filter((a) => a.attackerUserId === userId).length > 0 && (
              <span className="text-orange-300 font-semibold">
                ⚔️ {activeAttacks.filter((a) => a.attackerUserId === userId).length} công thành
              </span>
            )}
            {activeMissions.filter((m) => m.targetKind === "ROGUE_CAMP").length > 0 && (
              <span className="text-rose-300 font-semibold">
                👹 {activeMissions.filter((m) => m.targetKind === "ROGUE_CAMP").length} đánh quái
              </span>
            )}
            {activeMissions.filter((m) => m.targetKind === "RESOURCE").length > 0 && (
              <span className="text-amber-300 font-semibold">
                ⛏️ {activeMissions.filter((m) => m.targetKind === "RESOURCE").length} khai thác
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
