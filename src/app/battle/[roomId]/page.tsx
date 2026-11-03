"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type RuleSet = "basic" | "ocg";

type BattleCard = {
  id: string;
  slug?: string;
  name: string;
  battleType?: "MONSTER" | "SPELL" | "TRAP";
  cost: number;
  power: number;
  level: number;
  element: string;
  icon: string;
  imageUrl?: string | null;
  description?: string;
  rarity?: string;
  attack?: number;
  defense?: number;
  critRate?: number;
  evasionRate?: number;
  counterRate?: number;
  lifeStealRate?: number;
  bugPart?: string | null;
  specialEffect?: string;
  isEgyptianGod?: boolean;
};

type BoardCard = {
  card: BattleCard;
  hasAttacked: boolean;
  raBonus?: number;
};

type BoardSpellTrap = { card: BattleCard };

type PlayerSnapshot = {
  playerId: string;
  name: string;
  avatar: string;
  hp: number;
  handCount: number;
  board: BoardCard[];
  spellTrapCount: number;
  ruleSet: RuleSet;
};

type BattleMessage =
  | { type: "join" | "welcome"; playerId: string; player: PlayerSnapshot }
  | { type: "play-card"; playerId: string; card: BattleCard; handCount: number; tributeIds: string[]; clearsEnemyBoard: boolean; raPayment: number }
  | { type: "set-trap"; playerId: string; handCount: number; spellTrapCount: number }
  | { type: "spell-effect"; playerId: string; cardName: string; effect: string; handCount: number }
  | { type: "trap-trigger"; playerId: string; cardName: string; effect: string; damage: number }
  | { type: "draw"; playerId: string; handCount: number }
  | { type: "attack"; playerId: string; cardId: string; damage: number }
  | { type: "attack-hit"; playerId: string; cardId: string; damage: number }
  | { type: "evade"; playerId: string; damage: number }
  | { type: "counter"; playerId: string; damage: number }
  | { type: "end-turn"; playerId: string }
  | { type: "victory"; playerId: string; reason: string };

const BASIC_HP = 30;
const OCG_LIFE_POINTS = 8000;
const MAX_MANA = 10;
const MAX_BOARD_CARDS = 5;
const EXODIA_PARTS = new Set(["CE", "TLE", "MLE", "WA", "PE"]);

const EMPTY_OPPONENT: PlayerSnapshot = {
  playerId: "",
  name: "Đang tìm đối thủ...",
  avatar: "⌛",
  hp: BASIC_HP,
  handCount: 0,
  board: [],
  spellTrapCount: 0,
  ruleSet: "basic",
};

function getStartingLifePoints(ruleSet: RuleSet) {
  return ruleSet === "ocg" ? OCG_LIFE_POINTS : BASIC_HP;
}

function getRequiredTributes(card: BattleCard) {
  if (isEgyptianGod(card)) return 2;
  if (card.level >= 7) return 2;
  if (card.level >= 5) return 1;
  return 0;
}

function isEgyptianGod(card: BattleCard) {
  return card.isEgyptianGod || ["SLIFER", "RA", "OBELISK"].includes(card.specialEffect ?? "");
}

function getCardPool(ruleSet: RuleSet, customCards: BattleCard[] = []) {
  return ruleSet === "ocg" ? customCards : customCards.filter((card) => !isEgyptianGod(card));
}

function createStartingHand(playerId: string, ruleSet: RuleSet, customCards: BattleCard[] = []) {
  return getCardPool(ruleSet, customCards).slice(0, 5).map((card, index) => ({
    ...card,
    id: `${playerId}-${card.id}-${index}`,
  }));
}

function shuffleCards(cards: BattleCard[]) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getAttackStat(card: BattleCard, handCount: number, raBonus = 0) {
  if (card.specialEffect === "SLIFER") return handCount * 1000;
  return (card.attack ?? card.power * 1000) + raBonus;
}

function getDefenseStat(card: BattleCard, handCount: number) {
  if (card.specialEffect === "SLIFER") return handCount * 1000;
  return card.defense ?? card.power * 1000;
}

function mapServerCard(card: {
  id: string;
  slug: string;
  name: string;
  description: string;
  rarity: string;
  battleType: "MONSTER" | "SPELL" | "TRAP";
  attack: number;
  defense: number;
  manaCost: number;
  level: number;
  element: string;
  icon: string;
  critRate: number;
  evasionRate: number;
  counterRate: number;
  lifeStealRate: number;
  specialEffect: string;
  bugPart: string | null;
  imageUrl: string | null;
}): BattleCard {
  return {
    ...card,
    battleType: card.battleType,
    cost: card.manaCost,
    power: Math.max(1, Math.round(card.attack / 1000)),
    isEgyptianGod: ["SLIFER", "RA", "OBELISK"].includes(card.specialEffect),
  };
}

function isBattleCard(value: unknown): value is BattleCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    typeof card.name === "string" &&
    (card.battleType === undefined || card.battleType === "MONSTER" || card.battleType === "SPELL" || card.battleType === "TRAP") &&
    typeof card.cost === "number" &&
    typeof card.power === "number" &&
    typeof card.level === "number" &&
    typeof card.element === "string" &&
    typeof card.icon === "string" &&
    (card.attack === undefined || typeof card.attack === "number") &&
    (card.defense === undefined || typeof card.defense === "number") &&
    (card.critRate === undefined || typeof card.critRate === "number") &&
    (card.evasionRate === undefined || typeof card.evasionRate === "number") &&
    (card.counterRate === undefined || typeof card.counterRate === "number") &&
    (card.lifeStealRate === undefined || typeof card.lifeStealRate === "number") &&
    (card.bugPart === undefined || card.bugPart === null || typeof card.bugPart === "string") &&
    (card.specialEffect === undefined || typeof card.specialEffect === "string") &&
    (card.isEgyptianGod === undefined || typeof card.isEgyptianGod === "boolean")
  );
}

function isPlayerSnapshot(value: unknown): value is PlayerSnapshot {
  if (!value || typeof value !== "object") return false;
  const player = value as Record<string, unknown>;
  return (
    typeof player.playerId === "string" &&
    typeof player.name === "string" &&
    typeof player.avatar === "string" &&
    typeof player.hp === "number" &&
    typeof player.handCount === "number" &&
    typeof player.spellTrapCount === "number" &&
    Number.isInteger(player.spellTrapCount) &&
    player.spellTrapCount >= 0 &&
    player.spellTrapCount <= MAX_BOARD_CARDS &&
    (player.ruleSet === "basic" || player.ruleSet === "ocg") &&
    Array.isArray(player.board) &&
    player.board.every(
      (unit) =>
        Boolean(unit) &&
        typeof unit === "object" &&
        isBattleCard((unit as Record<string, unknown>).card) &&
        typeof (unit as Record<string, unknown>).hasAttacked === "boolean" &&
        ((unit as Record<string, unknown>).raBonus === undefined || typeof (unit as Record<string, unknown>).raBonus === "number"),
    )
  );
}

function isBattleMessage(value: unknown): value is BattleMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (typeof message.playerId !== "string" || typeof message.type !== "string") return false;

  switch (message.type) {
    case "join":
    case "welcome":
      return isPlayerSnapshot(message.player);
    case "play-card":
      return (
        isBattleCard(message.card) &&
        typeof message.handCount === "number" &&
        typeof message.clearsEnemyBoard === "boolean" &&
        typeof message.raPayment === "number" &&
        Array.isArray(message.tributeIds) &&
        message.tributeIds.every((id) => typeof id === "string")
      );
    case "set-trap":
      return typeof message.handCount === "number" && typeof message.spellTrapCount === "number";
    case "spell-effect":
      return typeof message.cardName === "string" &&
        ["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE"].includes(String(message.effect)) &&
        typeof message.handCount === "number";
    case "trap-trigger":
      return typeof message.cardName === "string" &&
        ["TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE"].includes(String(message.effect)) &&
        typeof message.damage === "number";
    case "draw":
      return typeof message.handCount === "number";
    case "attack":
    case "attack-hit":
      return typeof message.cardId === "string" && typeof message.damage === "number";
    case "evade":
    case "counter":
      return typeof message.damage === "number";
    case "end-turn":
      return true;
    case "victory":
      return typeof message.reason === "string";
    default:
      return false;
  }
}

function CardFace({
  card,
  compact = false,
  ruleSet,
  handCount = 0,
  raBonus = 0,
}: {
  card: BattleCard;
  compact?: boolean;
  ruleSet: RuleSet;
  handCount?: number;
  raBonus?: number;
}) {
  const battleType = card.battleType ?? "MONSTER";
  const battleTypeLabel = battleType === "SPELL" ? "Phép" : battleType === "TRAP" ? "Bẫy" : "Quái vật";
  return (
    <div
      className={`${compact
        ? "flex min-h-28 w-full flex-col gap-1 overflow-hidden rounded-lg p-1.5"
        : "grid h-full min-h-48 w-32 grid-rows-[auto_minmax(2rem,1fr)_auto] gap-2 overflow-hidden rounded-xl p-2 sm:w-36"
      } border ${
        card.isEgyptianGod ? "border-amber-300/70 shadow-amber-400/20" : "border-cyan-400/30"
      } bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-left shadow-lg shadow-black/30`}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
          {battleType === "MONSTER"
            ? ruleSet === "ocg" ? `★ ${card.level} · ${card.element}` : card.element
            : `${battleTypeLabel} · ${card.element}`}
        </span>
        {(ruleSet === "basic" || battleType !== "MONSTER") && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-200">
            {card.cost}
          </span>
        )}
      </div>
      {compact ? (
        <div
          className="grid min-h-10 flex-1 place-items-center overflow-hidden rounded-md bg-slate-950/60 bg-cover bg-center"
          style={card.imageUrl ? { backgroundImage: `url("${card.imageUrl}")` } : undefined}
        >
          <span className="rounded-full bg-slate-950/70 px-1.5 text-2xl" aria-hidden="true">
            {card.icon}
          </span>
        </div>
      ) : card.imageUrl ? (
        <div
          className="grid h-full min-h-8 place-items-center overflow-hidden rounded-lg bg-slate-950/60 bg-cover bg-center"
          style={{ backgroundImage: `url("${card.imageUrl}")` }}
          role="img"
          aria-label={card.name}
        >
          <span className="rounded-full bg-slate-950/60 px-1 text-xl" aria-hidden="true">{card.icon}</span>
        </div>
      ) : (
        <span className="grid h-full min-h-8 place-items-center rounded-lg bg-slate-950/40 text-3xl" aria-hidden="true">
          {card.icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-xs font-bold leading-4 text-white">{card.name}</p>
        <p className={`mt-1 break-words text-[10px] font-semibold leading-4 ${battleType === "MONSTER" ? "text-rose-300" : "text-violet-200"}`}>
          {battleType === "MONSTER"
            ? ruleSet === "ocg"
              ? `⚔ ${getAttackStat(card, handCount, raBonus)} / ${getDefenseStat(card, handCount)}`
              : `⚔ ${card.power}`
            : card.description || battleTypeLabel}
        </p>
      </div>
    </div>
  );
}

function HandCard({
  card,
  ruleSet,
  canAct,
  onPlay,
  onDragEnd,
}: {
  card: BattleCard;
  ruleSet: RuleSet;
  canAct: boolean;
  onPlay: () => void;
  onDragEnd: (info: PanInfo) => void;
}) {
  const dragControls = useDragControls();

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ opacity: 0, x: 90, y: -70, scale: 0.65, rotate: 8 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: -24, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      whileDrag={{ scale: 1.1, zIndex: 20, rotate: -3 }}
      className="w-32 shrink-0 sm:w-36"
      onDragEnd={(_, info) => onDragEnd(info)}
    >
      <div
        onPointerDown={(event) => dragControls.start(event)}
        className="relative cursor-grab touch-none rounded-xl text-left active:cursor-grabbing"
      >
        <CardFace card={card} ruleSet={ruleSet} />
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-slate-950/80 px-1.5 py-1 text-[10px] text-cyan-200">
          Kéo thẻ
        </span>
      </div>
      <button
        type="button"
        disabled={!canAct}
        onClick={onPlay}
        className="mt-1.5 w-full rounded-lg bg-cyan-500 px-2 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {card.battleType === "TRAP"
          ? "Úp bẫy"
          : card.battleType === "SPELL"
            ? "Kích hoạt phép"
            : ruleSet === "ocg" ? "Triệu hồi" : "Dùng bài"}
      </button>
    </motion.div>
  );
}

export default function BattleRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [playerId] = useState(() => crypto.randomUUID());
  const [ruleSet, setRuleSet] = useState<RuleSet>("basic");
  const [hand, setHand] = useState<BattleCard[]>([]);
  const [deckCards, setDeckCards] = useState<BattleCard[]>([]);
  const [deckReady, setDeckReady] = useState(false);
  const [deckLoadError, setDeckLoadError] = useState("");
  const [board, setBoard] = useState<BoardCard[]>([]);
  const [spellTraps, setSpellTraps] = useState<BoardSpellTrap[]>([]);
  const [mana, setMana] = useState(5);
  const [playerHp, setPlayerHp] = useState(BASIC_HP);
  const [opponent, setOpponent] = useState(EMPTY_OPPONENT);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [hasNormalSummoned, setHasNormalSummoned] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [pendingSummonCardId, setPendingSummonCardId] = useState<string | null>(null);
  const [selectedTributeIds, setSelectedTributeIds] = useState<string[]>([]);
  const [raLifePayment, setRaLifePayment] = useState(0);
  const [winner, setWinner] = useState<{ playerId: string; reason: string } | null>(null);
  const [drawIndex, setDrawIndex] = useState(5);
  const [attackingCardId, setAttackingCardId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseConfigured = Boolean(
    supabaseUrl && supabaseKey,
  );
  const [realtimeStatus, setRealtimeStatus] = useState(
    supabaseConfigured ? "Đang kết nối phòng realtime" : "Thiếu cấu hình Supabase — đang ở chế độ cục bộ",
  );
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const boardDropRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifeLabel = ruleSet === "ocg" ? "LP" : "HP";
  const playerCanAct = deckReady && getCardPool(ruleSet, deckCards).length >= 5 && isMyTurn && !winner && (!opponent.playerId || opponent.ruleSet === ruleSet);
  const pendingSummonCard = hand.find((card) => card.id === pendingSummonCardId);
  const requiredTributes = pendingSummonCard ? getRequiredTributes(pendingSummonCard) : 0;
  const playerSnapshotRef = useRef<PlayerSnapshot>({
    playerId,
    name: `Người chơi ${playerId.slice(0, 4)}`,
    avatar: "🧑‍💻",
    hp: playerHp,
    handCount: hand.length,
    board,
    spellTrapCount: spellTraps.length,
    ruleSet,
  });
  const opponentSnapshotRef = useRef(opponent);
  const spellTrapsRef = useRef(spellTraps);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const publish = useCallback(async (message: BattleMessage) => {
    const channel = channelRef.current;
    if (!channel) return;

    const result = await channel.send({
      type: "broadcast",
      event: "battle",
      payload: message,
    });
    if (result !== "ok") {
      setRealtimeStatus(`Không thể gửi sự kiện: ${result}`);
      notify("Không đồng bộ được thao tác với đối thủ.");
    }
  }, [notify]);

  function checkExodia(cards: BattleCard[]) {
    const parts = new Set(cards.map((card) => card.bugPart).filter((part): part is string => Boolean(part)));
    if (!winner && [...EXODIA_PARTS].every((part) => parts.has(part))) {
      const result = { playerId, reason: "Victory by Compile Error" };
      setWinner(result);
      setGameStarted(true);
      notify(result.reason);
      void publish({ type: "victory", ...result });
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/battle/deck")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Không tải được bộ bài PvP.");
        return result as {
          cards: Parameters<typeof mapServerCard>[0][];
          deck: { cardId: string; count: number }[];
        };
      })
      .then((result) => {
        if (!active) return;
        const ownedCards = new Map(result.cards.map((card) => [card.id, mapServerCard(card)]));
        const selectedDeck = result.deck.flatMap(({ cardId, count }) => {
          const card = ownedCards.get(cardId);
          return card ? Array.from({ length: count }, () => card) : [];
        });
        const shuffledDeck = shuffleCards(selectedDeck);
        setDeckCards(shuffledDeck);
        const startingHand = createStartingHand(playerId, "basic", shuffledDeck);
        setHand(startingHand);
        setDrawIndex(5);
        setDeckReady(true);
      })
      .catch((cause: unknown) => {
        if (active) {
          setDeckLoadError(cause instanceof Error ? cause.message : "Không tải được bộ bài PvP.");
          setDeckReady(true);
        }
      });
    return () => { active = false; };
  }, [playerId]);

  useEffect(() => {
    playerSnapshotRef.current = {
      playerId,
      name: `Người chơi ${playerId.slice(0, 4)}`,
      avatar: "🧑‍💻",
      hp: playerHp,
      handCount: hand.length,
      board,
      spellTrapCount: spellTraps.length,
      ruleSet,
    };
  }, [board, hand.length, playerHp, playerId, ruleSet, spellTraps.length]);

  useEffect(() => {
    if (!deckReady || deckLoadError || !channelRef.current) return;
    void publish({
      type: "join",
      playerId,
      player: playerSnapshotRef.current,
    });
  }, [deckLoadError, deckReady, playerId, publish]);

  useEffect(() => {
    opponentSnapshotRef.current = opponent;
  }, [opponent]);

  useEffect(() => {
    spellTrapsRef.current = spellTraps;
  }, [spellTraps]);

  // Broadcast the public game actions over a room-specific Supabase channel.
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const channel = supabase.channel(`room_${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "battle" }, ({ payload }) => {
      if (!isBattleMessage(payload) || payload.playerId === playerId) return;

      switch (payload.type) {
        case "join":
        case "welcome":
          setOpponent(payload.player);
          if (payload.player.ruleSet !== ruleSet) {
            notify("Hai người chơi cần chọn cùng một bộ luật.");
          } else {
            setIsMyTurn(playerId.localeCompare(payload.playerId) < 0);
          }
          if (payload.type === "join") {
            void channel.send({
              type: "broadcast",
              event: "battle",
              payload: {
                type: "welcome",
                playerId,
                player: playerSnapshotRef.current,
              } satisfies BattleMessage,
            });
          }
          break;
        case "play-card":
          setGameStarted(true);
          if (payload.clearsEnemyBoard) setBoard([]);
          setOpponent((current) => ({
            ...current,
            playerId: payload.playerId,
            board: [
              ...current.board.filter((unit) => !payload.tributeIds.includes(unit.card.id)),
              { card: payload.card, hasAttacked: false, raBonus: payload.raPayment },
            ].slice(0, MAX_BOARD_CARDS),
            handCount: Math.max(0, payload.handCount),
          }));
          break;
        case "set-trap":
          setGameStarted(true);
          setOpponent((current) => ({
            ...current,
            playerId: payload.playerId,
            handCount: Math.max(0, payload.handCount),
            spellTrapCount: Math.min(MAX_BOARD_CARDS, Math.max(0, payload.spellTrapCount)),
          }));
          break;
        case "spell-effect":
          setGameStarted(true);
          setOpponent((current) => ({
            ...current,
            playerId: payload.playerId,
            handCount: Math.max(0, payload.handCount),
            hp: payload.effect === "SPELL_HEAL"
              ? Math.min(getStartingLifePoints(current.ruleSet), current.hp + (current.ruleSet === "ocg" ? 1000 : 5))
              : current.hp,
          }));
          if (payload.effect === "SPELL_DAMAGE") {
            const damage = ruleSet === "ocg" ? 800 : 4;
            if (playerSnapshotRef.current.hp <= damage) {
              setWinner({ playerId: payload.playerId, reason: `${payload.cardName} hạ điểm sinh mệnh` });
            }
            setPlayerHp((current) => Math.max(0, current - damage));
          }
          notify(`${payload.cardName} đã kích hoạt.`);
          break;
        case "draw":
          setGameStarted(true);
          setOpponent((current) => ({
            ...current,
            playerId: payload.playerId,
            handCount: Math.max(0, payload.handCount),
          }));
          break;
        case "attack":
          setGameStarted(true);
          {
            const armedTraps = spellTrapsRef.current;
            const trapIndex = armedTraps.findIndex(({ card }) => card.battleType === "TRAP");
            if (trapIndex >= 0) {
              const triggeredTrap = armedTraps[trapIndex];
              const remainingTraps = armedTraps.filter((_, index) => index !== trapIndex);
              spellTrapsRef.current = remainingTraps;
              setSpellTraps(remainingTraps);
              const effect = triggeredTrap.card.specialEffect ?? "TRAP_NEGATE_ATTACK";
              const reflectedDamage = effect === "TRAP_REFLECT_DAMAGE"
                ? Math.max(1, Math.round(payload.damage * 0.25))
                : 0;
              notify(`${triggeredTrap.card.name} kích hoạt${reflectedDamage ? `, phản lại ${reflectedDamage} sát thương` : " và chặn đòn đánh"}!`);
              void channel.send({
                type: "broadcast",
                event: "battle",
                payload: {
                  type: "trap-trigger",
                  playerId,
                  cardName: triggeredTrap.card.name,
                  effect,
                  damage: reflectedDamage,
                } satisfies BattleMessage,
              });
              break;
            }
            const defender = playerSnapshotRef.current.board.reduce<BoardCard | null>(
              (best, unit) => !best || (unit.card.evasionRate ?? 0) + (unit.card.counterRate ?? 0) > (best.card.evasionRate ?? 0) + (best.card.counterRate ?? 0) ? unit : best,
              null,
            );
            if (defender && Math.random() * 100 < (defender.card.evasionRate ?? 0)) {
              notify(`${defender.card.name} né được đòn tấn công!`);
              void channel.send({
                type: "broadcast",
                event: "battle",
                payload: { type: "evade", playerId, damage: payload.damage } satisfies BattleMessage,
              });
              break;
            }
            if (playerSnapshotRef.current.hp <= payload.damage) {
              setWinner({ playerId: payload.playerId, reason: "Hết điểm sinh mệnh" });
            }
            setPlayerHp((current) => Math.max(0, current - payload.damage));
            notify(`Đối thủ tấn công! Bạn mất ${payload.damage.toLocaleString("vi-VN")} ${ruleSet === "ocg" ? "LP" : "HP"}.`);
            void channel.send({
              type: "broadcast",
              event: "battle",
              payload: { type: "attack-hit", playerId, cardId: payload.cardId, damage: payload.damage } satisfies BattleMessage,
            });
            if (defender && Math.random() * 100 < (defender.card.counterRate ?? 0)) {
              void channel.send({
                type: "broadcast",
                event: "battle",
                payload: { type: "counter", playerId, damage: Math.max(1, Math.round(payload.damage * 0.25)) } satisfies BattleMessage,
              });
            }
          }
          break;
        case "attack-hit": {
          if (opponentSnapshotRef.current.hp <= payload.damage) {
            setWinner({ playerId, reason: "Đối thủ hết điểm sinh mệnh" });
          }
          setOpponent((current) => ({ ...current, hp: Math.max(0, current.hp - payload.damage) }));
          const attackingUnit = playerSnapshotRef.current.board.find((unit) => unit.card.id === payload.cardId);
          const healing = Math.round(payload.damage * ((attackingUnit?.card.lifeStealRate ?? 0) / 100));
          if (healing > 0) setPlayerHp((current) => Math.min(getStartingLifePoints(ruleSet), current + healing));
          break;
        }
        case "evade":
          notify("Đối thủ đã né được đòn tấn công.");
          break;
        case "counter":
          if (playerSnapshotRef.current.hp <= payload.damage) {
            setWinner({ playerId: opponentSnapshotRef.current.playerId, reason: "Bị phản đòn đến hết điểm sinh mệnh" });
          }
          setPlayerHp((current) => Math.max(0, current - payload.damage));
          notify(`Bị phản đòn! Mất ${payload.damage.toLocaleString("vi-VN")} ${ruleSet === "ocg" ? "LP" : "HP"}.`);
          break;
        case "trap-trigger":
          setOpponent((current) => ({
            ...current,
            spellTrapCount: Math.max(0, current.spellTrapCount - 1),
          }));
          if (payload.damage > 0) {
            if (playerSnapshotRef.current.hp <= payload.damage) {
              setWinner({ playerId: payload.playerId, reason: "Bị phản lại sát thương từ bẫy" });
            }
            setPlayerHp((current) => Math.max(0, current - payload.damage));
            notify(`${payload.cardName} phản lại ${payload.damage.toLocaleString("vi-VN")} ${ruleSet === "ocg" ? "LP" : "HP"}!`);
          } else {
            notify(`${payload.cardName} đã chặn đòn tấn công.`);
          }
          break;
        case "end-turn":
          setGameStarted(true);
          setIsMyTurn(true);
          setMana(MAX_MANA);
          setHasDrawn(false);
          setHasNormalSummoned(false);
          setBoard((current) => current.map((unit) => ({ ...unit, hasAttacked: false })));
          break;
        case "victory":
          setWinner({ playerId: payload.playerId, reason: payload.reason });
          notify(payload.reason);
          break;
      }
    });

    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        setRealtimeConnected(true);
        setRealtimeStatus("Đã kết nối realtime");
        void channel.send({
          type: "broadcast",
          event: "battle",
          payload: {
            type: "join",
            playerId,
            player: playerSnapshotRef.current,
          } satisfies BattleMessage,
        });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeConnected(false);
        setRealtimeStatus(error?.message ?? "Không thể kết nối phòng realtime.");
      } else if (status === "CLOSED") {
        setRealtimeConnected(false);
        setRealtimeStatus("Kết nối phòng đã đóng.");
      }
    });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [notify, playerId, roomId, ruleSet, supabaseKey, supabaseUrl]);

  function playCard(card: BattleCard, tributeIds: string[] = [], raPayment: number | null = null) {
    if (!playerCanAct) {
      notify(opponent.playerId && opponent.ruleSet !== ruleSet ? "Hãy chọn cùng bộ luật với đối thủ." : "Chưa đến lượt của bạn.");
      return;
    }
    const battleType = card.battleType ?? "MONSTER";
    const isMonster = battleType === "MONSTER";
    const spendsMana = ruleSet === "basic" || !isMonster;
    if (spendsMana && card.cost > mana) {
      notify("Không đủ Mana để sử dụng lá bài này.");
      return;
    }
    if (!isMonster) {
      if (battleType === "TRAP") {
        if (spellTraps.length >= MAX_BOARD_CARDS) {
          notify("Khu vực Phép/Bẫy đã đầy.");
          return;
        }
        const nextHand = hand.filter((item) => item.id !== card.id);
        const nextTraps = [...spellTraps, { card }];
        setHand(nextHand);
        setMana((current) => current - card.cost);
        spellTrapsRef.current = nextTraps;
        setSpellTraps(nextTraps);
        setGameStarted(true);
        notify(`${card.name} đã được úp xuống sân.`);
        void publish({
          type: "set-trap",
          playerId,
          handCount: nextHand.length,
          spellTrapCount: nextTraps.length,
        });
        return;
      }

      const effect = card.specialEffect ?? "NONE";
      if (!["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE"].includes(effect)) {
        notify("Hiệu ứng Phép này chưa được hỗ trợ.");
        return;
      }
      const pool = getCardPool(ruleSet, deckCards);
      if (effect === "SPELL_DRAW" && drawIndex >= pool.length) {
        notify("Bộ bài đã hết.");
        return;
      }

      let nextHand = hand.filter((item) => item.id !== card.id);
      if (effect === "SPELL_DRAW") {
        const drawnCard = { ...pool[drawIndex], id: `${playerId}-${pool[drawIndex].id}-${drawIndex}` };
        nextHand = [...nextHand, drawnCard];
        setDrawIndex((current) => current + 1);
        checkExodia(nextHand);
      }
      setHand(nextHand);
      setMana((current) => current - card.cost);
      setGameStarted(true);
      if (effect === "SPELL_HEAL") {
        const healing = ruleSet === "ocg" ? 1000 : 5;
        setPlayerHp((current) => Math.min(getStartingLifePoints(ruleSet), current + healing));
      } else if (effect === "SPELL_DAMAGE") {
        const damage = ruleSet === "ocg" ? 800 : 4;
        if (opponentSnapshotRef.current.hp <= damage) {
          const result = { playerId, reason: `${card.name} hạ điểm sinh mệnh` };
          setWinner(result);
          void publish({ type: "victory", ...result });
        }
        setOpponent((current) => ({ ...current, hp: Math.max(0, current.hp - damage) }));
      }
      void publish({
        type: "spell-effect",
        playerId,
        cardName: card.name,
        effect,
        handCount: nextHand.length,
      });
      notify(`${card.name} đã kích hoạt.`);
      return;
    }
    if (ruleSet === "ocg" && hasNormalSummoned) {
      notify("Bạn đã triệu hồi thường trong lượt này.");
      return;
    }
    const requiredTributes = ruleSet === "ocg" ? getRequiredTributes(card) : 0;
    if (requiredTributes > 0 && tributeIds.length === 0) {
      if (board.length < requiredTributes) {
        notify(`Cần hiến tế ${requiredTributes} quái vật trên sân.`);
        return;
      }
      setPendingSummonCardId(card.id);
      setSelectedTributeIds([]);
      setRaLifePayment(0);
      notify(`Chọn ${requiredTributes} quái vật làm vật hiến tế.`);
      return;
    }
    if (
      tributeIds.length !== requiredTributes ||
      tributeIds.some((id) => !board.some((unit) => unit.card.id === id))
    ) {
      notify(`Cần chọn đúng ${requiredTributes} vật hiến tế.`);
      return;
    }
    if (card.specialEffect === "RA" && raPayment === null && tributeIds.length > 0) {
      setPendingSummonCardId(card.id);
      setSelectedTributeIds(tributeIds);
      return;
    }
    const lifePayment = raPayment ?? 0;
    if (lifePayment < 0 || !Number.isInteger(lifePayment) || lifePayment >= playerHp) {
      notify("Bạn phải giữ lại ít nhất 1 điểm sinh mệnh để dùng hiệu ứng Ra.");
      return;
    }
    if (board.length - tributeIds.length >= MAX_BOARD_CARDS) {
      notify("Sân đấu đã đầy.");
      return;
    }

    const nextHand = hand.filter((item) => item.id !== card.id);
    setHand(nextHand);
    if (spendsMana) setMana((current) => current - card.cost);
    if (ruleSet === "ocg") setHasNormalSummoned(true);
    if (lifePayment > 0) setPlayerHp((current) => Math.max(1, current - lifePayment));
    setGameStarted(true);
    setPendingSummonCardId(null);
    setSelectedTributeIds([]);
    const clearsEnemyBoard = ruleSet === "ocg" && isEgyptianGod(card);
    setBoard((current) => [
      ...current.filter((unit) => !tributeIds.includes(unit.card.id)),
      { card, hasAttacked: false, raBonus: lifePayment },
    ]);
    if (clearsEnemyBoard) {
      setOpponent((current) => ({ ...current, board: [] }));
      notify(`${card.name} được triệu hồi và quét sạch sân đối thủ!`);
    }
    void publish({
      type: "play-card",
      playerId,
      card,
      handCount: nextHand.length,
      tributeIds,
      clearsEnemyBoard,
      raPayment: lifePayment,
    });
  }

  function toggleTribute(cardId: string) {
    if (!pendingSummonCardId) return;
    const pendingCard = hand.find((card) => card.id === pendingSummonCardId);
    if (!pendingCard) return;
    const requiredTributes = getRequiredTributes(pendingCard);
    setSelectedTributeIds((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= requiredTributes) return current;
      return [...current, cardId];
    });
  }

  function changeRuleSet(nextRuleSet: RuleSet) {
    if (gameStarted || nextRuleSet === ruleSet) return;
    setRuleSet(nextRuleSet);
    const shuffledDeck = shuffleCards(deckCards);
    setDeckCards(shuffledDeck);
    const startingHand = createStartingHand(playerId, nextRuleSet, shuffledDeck);
    setHand(startingHand);
    checkExodia(startingHand);
    setBoard([]);
    spellTrapsRef.current = [];
    setSpellTraps([]);
    setMana(5);
    setPlayerHp(getStartingLifePoints(nextRuleSet));
    setOpponent({ ...EMPTY_OPPONENT, hp: getStartingLifePoints(nextRuleSet), ruleSet: nextRuleSet });
    setIsMyTurn(true);
    setHasDrawn(false);
    setHasNormalSummoned(false);
    setPendingSummonCardId(null);
    setSelectedTributeIds([]);
    setRaLifePayment(0);
    setWinner(null);
    setDrawIndex(5);
  }

  function handleCardDragEnd(card: BattleCard, info: PanInfo) {
    const bounds = boardDropRef.current?.getBoundingClientRect();
    if (
      bounds &&
      info.point.x >= bounds.left &&
      info.point.x <= bounds.right &&
      info.point.y >= bounds.top &&
      info.point.y <= bounds.bottom
    ) {
      const target = document
        .elementFromPoint(info.point.x, info.point.y)
        ?.closest<HTMLElement>("[data-tribute-id]");
      if (ruleSet === "ocg" && target && getRequiredTributes(card) > 0) {
        const tributeId = target.dataset.tributeId;
        if (tributeId && board.some((unit) => unit.card.id === tributeId)) {
          setPendingSummonCardId(card.id);
          setSelectedTributeIds([tributeId]);
          setRaLifePayment(0);
          notify(`Đã chọn 1 vật hiến tế. Chọn thêm ${Math.max(0, getRequiredTributes(card) - 1)} để triệu hồi.`);
          return;
        }
      }
      playCard(card);
    }
  }

  function drawCard() {
    if (!playerCanAct || hasDrawn) return;
    if (hand.length >= 8) {
      notify("Tay bài đã đủ 8 lá.");
      return;
    }

    const pool = getCardPool(ruleSet, deckCards);
    if (drawIndex >= pool.length) {
      notify("Bộ bài đã hết.");
      return;
    }
    const drawnFromPool = pool[drawIndex];
    const drawnCard = { ...drawnFromPool, id: `${playerId}-${drawnFromPool.id}-${drawIndex}` };
    const nextHand = [...hand, drawnCard];
    setHand(nextHand);
    checkExodia(nextHand);
    setDrawIndex((current) => current + 1);
    setHasDrawn(true);
    setGameStarted(true);
    void publish({ type: "draw", playerId, handCount: nextHand.length });
  }

  function attack(unit: BoardCard) {
    if (!playerCanAct || unit.hasAttacked || attackingCardId) return;
    const rawAttack = ruleSet === "ocg"
      ? getAttackStat(unit.card, hand.length, unit.raBonus)
      : unit.card.power;
    const critical = Math.random() * 100 < (unit.card.critRate ?? 0);
    const damage = critical ? rawAttack * 2 : rawAttack;
    setAttackingCardId(unit.card.id);
    setBoard((current) =>
      current.map((item) =>
        item.card.id === unit.card.id ? { ...item, hasAttacked: true } : item,
      ),
    );
    setTimeout(() => {
      setAttackingCardId(null);
      setGameStarted(true);
      if (critical) notify("Bạo kích! Sát thương được nhân đôi.");
      void publish({
        type: "attack",
        playerId,
        cardId: unit.card.id,
        damage,
      });
    }, 350);
  }

  function endTurn() {
    if (!playerCanAct || attackingCardId) return;
    setGameStarted(true);
    setIsMyTurn(false);
    void publish({ type: "end-turn", playerId });
  }

  const renderBoard = (
    units: BoardCard[],
    owner: "opponent" | "player",
  ) => {
    const renderMonsterZones = () => (
      <div>
        <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/55">
          Khu vực quái thú
        </p>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {Array.from({ length: MAX_BOARD_CARDS }, (_, index) => {
            const unit = units[index];
            return (
              <div
                key={`${owner}-slot-${index}`}
                data-tribute-id={owner === "player" && unit ? unit.card.id : undefined}
                aria-label={`Ô quái thú ${index + 1}${unit ? `: ${unit.card.name}` : ": trống"}`}
                className={`relative min-h-24 rounded-md border p-1 transition-colors sm:min-h-36 sm:rounded-lg sm:p-1.5 ${
                  unit && selectedTributeIds.includes(unit.card.id)
                    ? "border-amber-300 bg-amber-400/15 ring-1 ring-amber-300/50"
                    : "border-cyan-100/20 bg-slate-950/35"
                }`}
              >
                {unit ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.72 }}
                    animate={
                      attackingCardId === unit.card.id
                        ? { y: [-8, -38, 0], scale: [1, 1.08, 1] }
                        : { y: 0, scale: 1 }
                    }
                    transition={{ duration: 0.35 }}
                    className="h-full"
                  >
                    <CardFace
                      card={unit.card}
                      compact
                      ruleSet={ruleSet}
                      handCount={owner === "player" ? hand.length : opponent.handCount}
                      raBonus={unit.raBonus}
                    />
                    {owner === "player" && (
                      <div className="mt-1 grid gap-1">
                        {pendingSummonCardId && ruleSet === "ocg" && (
                          <button
                            type="button"
                            onClick={() => toggleTribute(unit.card.id)}
                            className={`w-full rounded-md px-1 py-1 text-[10px] font-bold ${
                              selectedTributeIds.includes(unit.card.id)
                                ? "bg-amber-300 text-slate-950"
                                : "bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                            }`}
                          >
                            {selectedTributeIds.includes(unit.card.id) ? "Đã chọn hiến tế" : "Chọn hiến tế"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!playerCanAct || unit.hasAttacked}
                          onClick={() => attack(unit)}
                          className="w-full rounded-md bg-rose-500/15 px-1 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {unit.hasAttacked ? "Đã tấn công" : "⚔ Tấn công"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="grid min-h-[5.5rem] place-items-center text-center text-[9px] font-semibold text-cyan-100/35 sm:min-h-32 sm:text-[10px]">
                    <span>{index + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    const renderSpellTrapZones = () => (
      <div>
        <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-violet-100/55">
          Khu vực phép thuật / bẫy
        </p>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {Array.from({ length: MAX_BOARD_CARDS }, (_, index) => {
            const ownTrap = owner === "player" ? spellTraps[index] : null;
            const opponentHasTrap = owner === "opponent" && index < opponent.spellTrapCount;
            const occupied = Boolean(ownTrap) || opponentHasTrap;
            return (
              <div
                key={`${owner}-spell-trap-${index}`}
                aria-label={`Ô phép thuật hoặc bẫy ${index + 1}${ownTrap ? `: ${ownTrap.card.name}` : occupied ? ": có bài úp" : ": trống"}`}
                className={`grid min-h-10 place-items-center rounded-md border p-1 text-center text-[9px] font-semibold sm:min-h-14 sm:rounded-lg ${
                  occupied ? "border-violet-300/50 bg-violet-900/50 text-violet-100" : "border-violet-200/20 bg-violet-950/20 text-violet-100/35"
                }`}
              >
                {ownTrap ? (
                  <span title={ownTrap.card.name}>🂠<span className="block truncate text-[8px]">{ownTrap.card.name}</span></span>
                ) : opponentHasTrap ? "🂠 Đã úp" : `S/T ${index + 1}`}
              </div>
            );
          })}
        </div>
      </div>
    );

    const renderAuxiliaryZones = () => (
      <div className="grid grid-cols-4 gap-1.5 border-t border-white/10 pt-2 sm:gap-2">
        {[
          ["✦", "Extra Deck"],
          ["◇", "Khu vực sân"],
          ["墓", "Mộ bài"],
          ["▤", "Bộ bài"],
        ].map(([icon, label]) => (
          <div
            key={`${owner}-${label}`}
            className="flex min-h-9 items-center justify-center gap-1 rounded-md border border-white/10 bg-slate-950/25 px-1 text-[8px] font-bold text-slate-300/65 sm:min-h-10 sm:gap-1.5 sm:text-[10px]"
          >
            <span className="text-cyan-200/70">{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    );

    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-2 sm:rounded-2xl sm:p-4 ${
          owner === "opponent"
            ? "border-rose-200/20 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.12),transparent_65%),linear-gradient(145deg,#172033,#101827_55%,#111827)]"
            : "border-cyan-200/25 bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15),transparent_65%),linear-gradient(145deg,#112532,#101d2a_55%,#111827)]"
        }`}
      >
        <div className={`pointer-events-none absolute inset-0 opacity-30 ${
          owner === "opponent"
            ? "bg-[radial-gradient(circle_at_15%_25%,rgba(251,113,133,0.45)_1px,transparent_1.5px),radial-gradient(circle_at_75%_70%,rgba(255,255,255,0.35)_1px,transparent_1.5px)]"
            : "bg-[radial-gradient(circle_at_25%_70%,rgba(34,211,238,0.45)_1px,transparent_1.5px),radial-gradient(circle_at_85%_25%,rgba(255,255,255,0.35)_1px,transparent_1.5px)]"
        }`} />
        <div className="relative space-y-2 sm:space-y-3">
          {owner === "opponent" ? (
            <>
              {renderSpellTrapZones()}
              {renderMonsterZones()}
            </>
          ) : (
            <>
              {renderMonsterZones()}
              {renderSpellTrapZones()}
            </>
          )}
          {renderAuxiliaryZones()}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl rounded-3xl border border-slate-800 bg-slate-950 p-3 text-slate-100 shadow-2xl shadow-cyan-950/20 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">A2OJ · Đấu bài</p>
          <h1 className="mt-1 text-xl font-black sm:text-2xl">Phòng {roomId}</h1>
        </div>
        <p className={`rounded-full border px-3 py-1.5 text-xs ${realtimeConnected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
          <span className="mr-2 inline-block size-2 rounded-full bg-current" />
          {realtimeStatus}
        </p>
      </header>

      {!deckReady && (
        <p role="status" className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100">
          Đang tải bộ bài PvP của bạn...
        </p>
      )}
      {deckReady && (deckLoadError || getCardPool(ruleSet, deckCards).length < 5) && (
        <section className="mb-4 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4">
          <p className="font-bold text-amber-100">{deckLoadError || "Bộ bài chưa đủ 5 lá hợp lệ theo luật đang chọn."}</p>
          <p className="mt-1 text-sm text-slate-300">
            Quay Gacha để nhận thẻ Battle Ready, sau đó chọn từ 5–20 lá trong bộ bài.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/battle/deck" className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">Quản lý bộ bài</Link>
            <Link href="/gacha" className="rounded-lg border border-amber-200/30 px-3 py-2 text-xs font-bold text-amber-100">Đi Gacha</Link>
            {deckLoadError.includes("đăng nhập") && <Link href="/login" className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-200">Đăng nhập</Link>}
          </div>
        </section>
      )}

      <section aria-label="Chọn luật đấu" className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">Bộ luật trận đấu</h2>
          {gameStarted && <span className="text-[10px] text-slate-500">Đã khóa sau khi trận bắt đầu</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={gameStarted}
            onClick={() => changeRuleSet("basic")}
            className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ${
              ruleSet === "basic"
                ? "border-cyan-400/50 bg-cyan-400/10"
                : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <span className="block text-sm font-bold text-cyan-100">Basic</span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              30 HP, dùng Mana để gọi quái vật. Luật đơn giản cho trận nhanh.
            </span>
          </button>
          <button
            type="button"
            disabled={gameStarted}
            onClick={() => changeRuleSet("ocg")}
            className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ${
              ruleSet === "ocg"
                ? "border-amber-300/50 bg-amber-300/10"
                : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <span className="block text-sm font-bold text-amber-100">OCG · Thần Ai Cập</span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              8000 LP, mỗi lượt 1 triệu hồi thường; cấp 5–6 cần 1 hiến tế, cấp 7+ cần 2. Bản A2OJ cho Thần Ai Cập dùng 2 vật hiến tế.
            </span>
          </button>
        </div>
        {ruleSet === "ocg" && (
          <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[11px] leading-5 text-amber-100/80">
            Đây là biến thể OCG rút gọn của A2OJ (luật chính thức yêu cầu 3 hiến tế cho Thần Ai Cập). Bài Phép dùng ngay; Bẫy được úp và tự kích hoạt ở đòn tấn công đầu tiên. Thần có hiệu ứng riêng; Phép/Bẫy dùng Mana.
          </p>
        )}
        {opponent.playerId && opponent.ruleSet !== ruleSet && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            Đối thủ đang chọn luật {opponent.ruleSet.toUpperCase()}. Hãy thống nhất luật trước khi tiếp tục.
          </p>
        )}
      </section>

      {!realtimeConnected && (
        <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-100/80">
          Cấu hình <code>NEXT_PUBLIC_SUPABASE_URL</code> và một trong hai biến{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> hoặc{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> để kết nối người chơi khác trong cùng phòng.
        </p>
      )}

      {winner && (
        <section role="status" aria-live="assertive" className={`mb-4 rounded-2xl border p-4 text-center ${
          winner.playerId === playerId
            ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
            : "border-rose-300/30 bg-rose-400/10 text-rose-100"
        }`}>
          <p className="text-xl font-black">{winner.playerId === playerId ? "🏆 Chiến thắng!" : "💀 Thất bại"}</p>
          <p className="mt-1 text-sm">{winner.reason}</p>
        </section>
      )}

      <section aria-label="Thông tin đối thủ" className="rounded-2xl border border-rose-400/20 bg-gradient-to-r from-rose-950/40 to-slate-900 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border border-rose-300/30 bg-rose-400/10 text-2xl">
            {opponent.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{opponent.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-rose-400 transition-all" style={{ width: `${Math.max(0, opponent.hp / getStartingLifePoints(ruleSet)) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-rose-200">{opponent.hp.toLocaleString("vi-VN")} {lifeLabel}</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300">🂠 {opponent.handCount}</span>
        </div>
      </section>

      <section aria-label="Sân đấu đối thủ" className="my-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-2.5 sm:p-4">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>Sân đối thủ</span><span>{opponent.board.length}/{MAX_BOARD_CARDS}</span>
        </div>
        {renderBoard(opponent.board, "opponent")}
      </section>

      {pendingSummonCard && ruleSet === "ocg" && (
        <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3">
          <div className="min-w-52 flex-1">
            <p className="text-xs text-amber-100">
              Triệu hồi <strong>{pendingSummonCard.name}</strong>: chọn {requiredTributes} vật hiến tế trên sân ({selectedTributeIds.length}/{requiredTributes}).
            </p>
            {pendingSummonCard.specialEffect === "RA" && (
              <label className="mt-3 block max-w-xs text-xs text-amber-100">
                Hiến tế LP để tăng ATK cho Ra (còn {Math.max(0, playerHp - 1)}):
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, playerHp - 1)}
                  value={raLifePayment}
                  onChange={(event) => setRaLifePayment(Math.min(Math.max(0, Number(event.target.value)), Math.max(0, playerHp - 1)))}
                  className="mt-1 w-full rounded-lg border border-amber-300/20 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPendingSummonCardId(null); setSelectedTributeIds([]); setRaLifePayment(0); }}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!playerCanAct || selectedTributeIds.length !== requiredTributes || raLifePayment >= playerHp}
              onClick={() => playCard(pendingSummonCard, selectedTributeIds, raLifePayment)}
              className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hiến tế & triệu hồi
            </button>
          </div>
        </section>
      )}

      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <span className="text-xs font-black tracking-[0.3em] text-cyan-300/60">VS</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </div>

      <section
        ref={boardDropRef}
        aria-label="Sân đấu của bạn, thả bài vào đây"
        className="rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-cyan-950/15 to-slate-900/80 p-2.5 ring-cyan-400/20 transition-colors [&:hover]:border-cyan-400/40 sm:p-4"
      >
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
          <span>Sân của bạn · Kéo bài vào đây</span><span>{board.length}/{MAX_BOARD_CARDS}</span>
        </div>
        {renderBoard(board, "player")}
      </section>

      <section aria-label="Thông tin người chơi và lượt" className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-900 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-xl">🧑‍💻</div>
            <div>
              <p className="text-sm font-bold">Người chơi của bạn</p>
              <p className="text-xs text-slate-400">
                <span className="text-cyan-300">{playerHp.toLocaleString("vi-VN")} {lifeLabel}</span>
                <span className="text-violet-300"> · 💎 {mana}/{MAX_MANA} Mana</span>
                {ruleSet === "ocg" && <> · <span className="text-amber-200">Triệu hồi thường: {hasNormalSummoned ? "đã dùng" : "còn"}</span></>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={drawCard} disabled={!playerCanAct || hasDrawn} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40">
              {hasDrawn ? "Đã bốc bài" : "🂠 Bốc bài"}
            </button>
            <button type="button" onClick={endTurn} disabled={!playerCanAct || Boolean(attackingCardId)} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              Kết thúc lượt →
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className={playerCanAct ? "font-bold text-emerald-300" : "text-slate-500"}>
            {playerCanAct ? "● Đến lượt bạn" : "○ Đang chờ đối thủ"}
          </span>
          <span className="text-slate-500">Bài trên tay: {hand.length}</span>
        </div>
      </section>

      <section aria-label="Bài trên tay" className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Bài trên tay</h2>
          <span className="text-xs text-slate-500">Kéo thả vào sân để sử dụng</span>
        </div>
        {hand.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">Không còn bài trên tay.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto px-1 pb-2">
            <AnimatePresence initial={false}>
              {hand.map((card) => (
                <HandCard
                  key={card.id}
                  card={card}
                  ruleSet={ruleSet}
                  canAct={playerCanAct}
                  onPlay={() => playCard(card)}
                  onDragEnd={(info) => handleCardDragEnd(card, info)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-300/20 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
