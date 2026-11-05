"use client";

import { Chess, type Square } from "chess.js";
import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  Clock3,
  Crown,
  Flag,
  Handshake,
  MessageCircle,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Chessboard } from "react-chessboard";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

export type ChessArenaMove = {
  fen: string;
  san: string;
  from: Square;
  to: Square;
  color: "w" | "b";
  promotion?: string;
};

export type ChessArenaAction =
  | { type: "move"; san: string }
  | { type: "resign"; color: "w" | "b" }
  | { type: "timeout"; color: "w" | "b" }
  | { type: "draw-offer"; color: "w" | "b" }
  | { type: "draw-cancel"; color: "w" | "b" }
  | { type: "draw-accept" }
  | { type: "new-game" };

export type ChessArenaRemoteAction = {
  id: string;
  action: ChessArenaAction;
};

type ChessArenaProps = {
  whitePlayerName?: string;
  blackPlayerName?: string;
  initialTimeSeconds?: number;
  incrementSeconds?: number;
  playerColor?: "w" | "b";
  canPlay?: boolean;
  clockRunning?: boolean;
  remoteAction?: ChessArenaRemoteAction | null;
  onMove?: (move: ChessArenaMove) => void;
  onGameAction?: (action: ChessArenaAction) => void;
};

type GameResult = {
  title: string;
  description: string;
  winner: "w" | "b" | null;
};

type PanelTab = "moves" | "chat" | "leaderboard";

type ChatMessage = {
  id: number;
  text: string;
  sender: "white" | "black";
};

const DEFAULT_TIME_SECONDS = 5 * 60;
const QUICK_REACTIONS = ["👏", "🔥", "😮", "💪"];

function isChessSquare(square: string): square is Square {
  return /^[a-h][1-8]$/.test(square);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getGameResult(game: Chess): GameResult | null {
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return {
      title: winner === "w" ? "Trắng chiến thắng!" : "Đen chiến thắng!",
      description: "Chiếu hết — một ván cờ tuyệt vời.",
      winner,
    };
  }

  if (game.isStalemate()) {
    return {
      title: "Ván cờ hòa",
      description: "Hết nước đi hợp lệ nhưng vua không bị chiếu.",
      winner: null,
    };
  }

  if (game.isDraw()) {
    return {
      title: "Ván cờ hòa",
      description: game.isInsufficientMaterial()
        ? "Không đủ quân để chiếu hết."
        : "Ván cờ hòa theo luật cờ vua.",
      winner: null,
    };
  }

  return null;
}

function PlayerCard({
  name,
  color,
  seconds,
  isActive,
  rating,
}: {
  name: string;
  color: "w" | "b";
  seconds: number;
  isActive: boolean;
  rating: string;
}) {
  const isWhite = color === "w";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-900/80 px-3 py-2.5 shadow-lg shadow-black/10 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold shadow-inner ${
            isWhite
              ? "bg-slate-100 text-slate-800"
              : "bg-slate-700 text-slate-100"
          }`}
        >
          {isWhite ? "♔" : "♚"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
            <span className="hidden rounded-md border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 sm:inline">
              {rating}
            </span>
          </div>
          <p className="text-xs text-slate-400">{isWhite ? "Trắng" : "Đen"}</p>
        </div>
      </div>

      <div
        aria-label={`Thời gian còn lại ${formatTime(seconds)}`}
        className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 font-mono text-lg font-bold tabular-nums ${
          isActive
            ? "bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/30"
            : "bg-slate-800 text-slate-200"
        }`}
      >
        <Clock3 aria-hidden="true" className="size-4" />
        {formatTime(seconds)}
      </div>
    </div>
  );
}

function ResultModal({
  result,
  onNewGame,
}: {
  result: GameResult;
  onNewGame: () => void;
}) {
  return (
    <div
      aria-labelledby="chess-result-title"
      aria-modal="true"
      className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-3xl border border-emerald-300/20 bg-slate-900 p-6 text-center shadow-2xl shadow-black/50 sm:p-8">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          {result.winner ? (
            <Crown aria-hidden="true" className="size-7" />
          ) : (
            <Handshake aria-hidden="true" className="size-7" />
          )}
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
          Trận đấu kết thúc
        </p>
        <h2
          className="text-2xl font-black tracking-tight text-white"
          id="chess-result-title"
        >
          {result.title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{result.description}</p>
        <button
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          onClick={onNewGame}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Ván mới
        </button>
      </div>
    </div>
  );
}

export function ChessArena({
  whitePlayerName = "Người chơi 1",
  blackPlayerName = "Người chơi 2",
  initialTimeSeconds = DEFAULT_TIME_SECONDS,
  incrementSeconds = 0,
  playerColor,
  canPlay = true,
  clockRunning = true,
  remoteAction,
  onMove,
  onGameAction,
}: ChessArenaProps) {
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">(
    playerColor === "b" ? "black" : "white",
  );
  const [whiteTime, setWhiteTime] = useState(initialTimeSeconds);
  const [blackTime, setBlackTime] = useState(initialTimeSeconds);
  const [manualResult, setManualResult] = useState<GameResult | null>(null);
  const [drawOffer, setDrawOffer] = useState<"w" | "b" | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("moves");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const lastRemoteActionIdRef = useRef<string | null>(null);
  const timeoutReportedRef = useRef(false);

  const game = useMemo(() => {
    const nextGame = new Chess();
    for (const san of moveHistory) nextGame.move(san);
    return nextGame;
  }, [moveHistory]);

  const activeColor = game.turn();
  const result = useMemo(
    () =>
      manualResult ??
      (activeColor === "w" && whiteTime === 0
        ? {
            title: `${blackPlayerName} chiến thắng!`,
            description: "Đối thủ đã hết thời gian.",
            winner: "b" as const,
          }
        : activeColor === "b" && blackTime === 0
          ? {
              title: `${whitePlayerName} chiến thắng!`,
              description: "Đối thủ đã hết thời gian.",
              winner: "w" as const,
            }
          : null),
    [activeColor, blackPlayerName, blackTime, manualResult, whitePlayerName, whiteTime],
  );
  const lastMove = game.history({ verbose: true }).at(-1);
  const checkedKing = game.isCheck()
    ? game.findPiece({ type: "k", color: activeColor })[0]
    : undefined;

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgb(250 204 21 / 48%)",
      };
      for (const move of game.moves({ verbose: true, square: selectedSquare })) {
        const target = game.get(move.to);
        styles[move.to] = {
          ...(target
            ? { boxShadow: "inset 0 0 0 4px rgb(34 197 94 / 65%)" }
            : {
                backgroundImage:
                  "radial-gradient(circle, rgb(15 23 42 / 32%) 0 22%, transparent 24%)",
              }),
        };
        if (move.isKingsideCastle() || move.isQueensideCastle()) {
          const rookSquare = move.isKingsideCastle()
            ? move.color === "w"
              ? "h1"
              : "h8"
            : move.color === "w"
              ? "a1"
              : "a8";
          styles[rookSquare] = {
            backgroundColor: "rgb(34 197 94 / 24%)",
            boxShadow: "inset 0 0 0 3px rgb(34 197 94 / 55%)",
          };
        }
      }
    }

    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgb(163 230 53 / 42%)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgb(163 230 53 / 55%)",
      };
    }

    if (checkedKing) {
      styles[checkedKing] = {
        backgroundColor: "rgb(239 68 68 / 70%)",
        boxShadow: "inset 0 0 0 4px rgb(127 29 29 / 65%)",
      };
    }

    return styles;
  }, [checkedKing, game, lastMove, selectedSquare]);

  useEffect(() => {
    if (result || !clockRunning) return;

    const timer = window.setInterval(() => {
      const setClock = activeColor === "w" ? setWhiteTime : setBlackTime;
      setClock((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeColor, clockRunning, result]);

  useEffect(() => {
    if (
      !playerColor ||
      !clockRunning ||
      manualResult ||
      timeoutReportedRef.current
    ) {
      return;
    }

    const playerTime = playerColor === "w" ? whiteTime : blackTime;
    if (playerTime === 0) {
      timeoutReportedRef.current = true;
      onGameAction?.({ type: "timeout", color: playerColor });
    }
  }, [blackTime, clockRunning, manualResult, onGameAction, playerColor, whiteTime]);

  useEffect(() => {
    if (!remoteAction || remoteAction.id === lastRemoteActionIdRef.current) return;
    lastRemoteActionIdRef.current = remoteAction.id;

    const timer = window.setTimeout(() => {
      const action = remoteAction.action;
      if (action.type === "move") {
        try {
          const nextGame = new Chess();
          for (const san of moveHistory) nextGame.move(san);
          const move = nextGame.move(action.san);
          setMoveHistory(nextGame.history());
          setSelectedSquare(null);
          setManualResult(getGameResult(nextGame));
          if (incrementSeconds > 0) {
            (move.color === "w" ? setWhiteTime : setBlackTime)((seconds) =>
              seconds + incrementSeconds,
            );
          }
        } catch (error) {
          console.error("Received an invalid remote chess move:", error);
        }
        return;
      }

      if (action.type === "resign" || action.type === "timeout") {
        const winner = action.color === "w" ? "b" : "w";
        setManualResult({
          title: winner === "w" ? `${whitePlayerName} chiến thắng!` : `${blackPlayerName} chiến thắng!`,
          description:
            action.type === "timeout"
              ? `${action.color === "w" ? whitePlayerName : blackPlayerName} đã hết thời gian.`
              : `${action.color === "w" ? whitePlayerName : blackPlayerName} đã đầu hàng.`,
          winner,
        });
      } else if (action.type === "draw-offer") {
        setDrawOffer(action.color);
      } else if (action.type === "draw-cancel") {
        setDrawOffer((offer) => offer === action.color ? null : offer);
      } else if (action.type === "draw-accept") {
        setManualResult({
          title: "Ván cờ hòa",
          description: "Hai người chơi đã đồng ý hòa.",
          winner: null,
        });
        setDrawOffer(null);
      } else if (action.type === "new-game") {
        setMoveHistory([]);
        setSelectedSquare(null);
        setWhiteTime(initialTimeSeconds);
        setBlackTime(initialTimeSeconds);
        setManualResult(null);
        setDrawOffer(null);
        setOrientation(playerColor === "b" ? "black" : "white");
        timeoutReportedRef.current = false;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    blackPlayerName,
    initialTimeSeconds,
    incrementSeconds,
    moveHistory,
    playerColor,
    remoteAction,
    whitePlayerName,
  ]);

  function makeMove(sourceSquare: string, targetSquare: string) {
    if (
      result ||
      !canPlay ||
      (playerColor !== undefined && playerColor !== activeColor) ||
      !isChessSquare(sourceSquare) ||
      !isChessSquare(targetSquare)
    ) {
      return false;
    }

    const legalMoves = game.moves({ verbose: true, square: sourceSquare });
    const targetPiece = game.get(targetSquare);
    const castleMove =
      game.get(sourceSquare)?.type === "k" &&
      targetPiece?.type === "r" &&
      targetPiece.color === activeColor
        ? legalMoves.find((move) =>
            targetSquare[0] === "h"
              ? move.isKingsideCastle()
              : targetSquare[0] === "a" && move.isQueensideCastle(),
          )
        : undefined;
    const legalMove =
      legalMoves.find((move) => move.to === targetSquare) ?? castleMove;

    if (!legalMove) return false;
    if (drawOffer !== null && drawOffer !== game.turn()) setDrawOffer(null);

    const move = game.move({
      from: legalMove.from,
      to: legalMove.to,
      ...(legalMove.isPromotion() ? { promotion: "q" } : {}),
    });

    setSelectedSquare(null);
    setMoveHistory(game.history());
    if (incrementSeconds > 0) {
      (move.color === "w" ? setWhiteTime : setBlackTime)((seconds) =>
        seconds + incrementSeconds,
      );
    }
    setManualResult(getGameResult(game));
    onGameAction?.({ type: "move", san: move.san });
    onMove?.({
      fen: game.fen(),
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    });

    return true;
  }

  function handlePieceDrop(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare) {
      setSelectedSquare(null);
      return false;
    }
    setSelectedSquare(null);
    return makeMove(sourceSquare, targetSquare);
  }

  function handleSquareClick(square: string) {
    if (!canPlay || result || !isChessSquare(square)) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && makeMove(selectedSquare, square)) return;

    const piece = game.get(square);
    setSelectedSquare(
      piece?.color === activeColor &&
        (playerColor === undefined || playerColor === activeColor)
        ? square
        : null,
    );
  }

  function handleDrawAction() {
    const offeringColor = playerColor ?? activeColor;
    if (drawOffer === offeringColor) {
      setDrawOffer(null);
      onGameAction?.({ type: "draw-cancel", color: offeringColor });
      return;
    }

    if (drawOffer !== null) {
      setManualResult({
        title: "Ván cờ hòa",
        description: "Hai người chơi đã đồng ý hòa.",
        winner: null,
      });
      setDrawOffer(null);
      onGameAction?.({ type: "draw-accept" });
      return;
    }

    setDrawOffer(offeringColor);
    onGameAction?.({ type: "draw-offer", color: offeringColor });
  }

  function handleResign() {
    const resigningColor = playerColor ?? activeColor;
    const winner = resigningColor === "w" ? "b" : "w";
    setManualResult({
      title: winner === "w" ? `${whitePlayerName} chiến thắng!` : `${blackPlayerName} chiến thắng!`,
      description: `${resigningColor === "w" ? whitePlayerName : blackPlayerName} đã đầu hàng.`,
      winner,
    });
    onGameAction?.({ type: "resign", color: resigningColor });
  }

  function handleNewGame() {
    setMoveHistory([]);
    setSelectedSquare(null);
    setWhiteTime(initialTimeSeconds);
    setBlackTime(initialTimeSeconds);
    setManualResult(null);
    setDrawOffer(null);
    setOrientation(playerColor === "b" ? "black" : "white");
    timeoutReportedRef.current = false;
    onGameAction?.({ type: "new-game" });
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((messages) => [
      ...messages,
      { id: Date.now(), text, sender: activeColor === "w" ? "white" : "black" },
    ]);
    setChatDraft("");
  }

  function addReaction(reaction: string) {
    setChatMessages((messages) => [
      ...messages,
      {
        id: Date.now() + messages.length,
        text: reaction,
        sender: activeColor === "w" ? "white" : "black",
      },
    ]);
  }

  const boardOptions = {
    position: game.fen(),
    boardOrientation: orientation,
    boardStyle: {
      width: "100%",
      borderRadius: "0.75rem",
      overflow: "hidden" as const,
      boxShadow: "0 24px 60px rgb(0 0 0 / 35%)",
    },
    darkSquareStyle: { backgroundColor: "#4b7863" },
    lightSquareStyle: { backgroundColor: "#e5e9d8" },
    squareStyles,
    showNotation: true,
    showAnimations: true,
    animationDurationInMs: 180,
    allowDragging: !result && canPlay,
    canDragPiece: ({ square }: { square: string | null }) =>
      !result &&
      canPlay &&
      square !== null &&
      isChessSquare(square) &&
      (playerColor === undefined || playerColor === activeColor) &&
      game.get(square)?.color === activeColor,
    onPieceDrop: ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => handlePieceDrop(sourceSquare, targetSquare),
    onSquareClick: ({ square }: { square: string }) => handleSquareClick(square),
  };

  const movePairs = Array.from(
    { length: Math.ceil(moveHistory.length / 2) },
    (_, index) => ({
      number: index + 1,
      white: moveHistory[index * 2],
      black: moveHistory[index * 2 + 1],
    }),
  );

  const drawButtonLabel =
    drawOffer === (playerColor ?? activeColor)
      ? "Hủy lời xin hòa"
      : drawOffer
        ? "Chấp nhận hòa"
        : "Xin hòa";
  const topPlayerColor = playerColor === "b" ? "w" : "b";
  const topPlayerName = topPlayerColor === "w" ? whitePlayerName : blackPlayerName;
  const bottomPlayerColor = topPlayerColor === "w" ? "b" : "w";
  const bottomPlayerName =
    bottomPlayerColor === "w" ? whitePlayerName : blackPlayerName;

  return (
    <section className="mx-auto w-full max-w-7xl text-slate-100">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            <Sparkles aria-hidden="true" className="size-4" />
            A2OJ Chess Arena
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Sẵn sàng khai cuộc?
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {formatTime(initialTimeSeconds)} mỗi bên
            {incrementSeconds > 0 ? ` + ${incrementSeconds} giây/nước` : ""}
            {" · "}
            {playerColor ? "Đấu online" : "Người chơi vs Người chơi"}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400" />
          {playerColor ? "Ván đấu online" : "Ván đấu cục bộ"}
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="space-y-3">
          <PlayerCard
            color={topPlayerColor}
            isActive={activeColor === topPlayerColor && !result}
            name={topPlayerName}
            rating={topPlayerColor === "w" ? "1,320" : "1,284"}
            seconds={topPlayerColor === "w" ? whiteTime : blackTime}
          />

          <div className="relative rounded-2xl border border-white/8 bg-slate-900/65 p-2 shadow-2xl shadow-black/25 sm:p-3">
            <Chessboard options={boardOptions} />
            {result && (
              <ResultModal result={result} onNewGame={handleNewGame} />
            )}
          </div>
          <p className="px-1 text-xs leading-5 text-slate-500">
            Kéo quân hoặc chạm quân rồi chạm ô đích. Nhập thành bằng cách đi vua
            hai ô hoặc kéo vua vào ô xe. Bắt tốt qua đường được phép ngay sau khi
            đối thủ tiến tốt hai ô.
          </p>

          <PlayerCard
            color={bottomPlayerColor}
            isActive={activeColor === bottomPlayerColor && !result}
            name={bottomPlayerName}
            rating={bottomPlayerColor === "w" ? "1,320" : "1,284"}
            seconds={bottomPlayerColor === "w" ? whiteTime : blackTime}
          />

          {drawOffer && !result && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2 text-sm text-amber-100">
              <Handshake aria-hidden="true" className="size-4 shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1">
                {drawOffer === "w" ? whitePlayerName : blackPlayerName} đang xin hòa.
              </span>
              <button
                aria-label="Hủy lời xin hòa"
                className="grid size-7 shrink-0 place-items-center rounded-lg text-amber-100/70 hover:bg-amber-100/10 hover:text-amber-50"
                onClick={() => setDrawOffer(null)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-2 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              disabled={Boolean(result)}
              onClick={handleResign}
              type="button"
            >
              <Flag aria-hidden="true" className="size-4" />
              Đầu hàng
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-2 text-xs font-semibold text-slate-300 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              disabled={Boolean(result)}
              onClick={handleDrawAction}
              type="button"
            >
              {drawOffer && drawOffer !== activeColor ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <Handshake aria-hidden="true" className="size-4" />
              )}
              <span className="truncate">{drawButtonLabel}</span>
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 sm:text-sm"
              onClick={() =>
                setOrientation((current) =>
                  current === "white" ? "black" : "white",
                )
              }
              type="button"
            >
              <ArrowDownUp aria-hidden="true" className="size-4" />
              Đổi hướng
            </button>
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80 shadow-xl shadow-black/15">
          <div
            aria-label="Bảng điều khiển ván đấu"
            className="grid grid-cols-3 border-b border-white/8 p-1.5"
            role="tablist"
          >
            <button
              aria-controls="chess-panel-moves"
              aria-selected={activeTab === "moves"}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === "moves"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("moves")}
              id="chess-tab-moves"
              role="tab"
              type="button"
            >
              <Shield aria-hidden="true" className="size-4" />
              Nước đi
            </button>
            <button
              aria-controls="chess-panel-chat"
              aria-selected={activeTab === "chat"}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === "chat"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("chat")}
              id="chess-tab-chat"
              role="tab"
              type="button"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              Chat
            </button>
            <button
              aria-controls="chess-panel-leaderboard"
              aria-selected={activeTab === "leaderboard"}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
                activeTab === "leaderboard"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("leaderboard")}
              id="chess-tab-leaderboard"
              role="tab"
              type="button"
            >
              <Trophy aria-hidden="true" className="size-4" />
              BXH
            </button>
          </div>

          <div
            aria-labelledby="chess-tab-moves"
            className={activeTab === "moves" ? "block" : "hidden"}
            id="chess-panel-moves"
            role="tabpanel"
          >
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
              <div>
                <h2 className="text-sm font-bold text-white">Lịch sử nước đi</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ký hiệu đại số · {moveHistory.length} nước
                </p>
              </div>
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {activeColor === "w" ? "Lượt Trắng" : "Lượt Đen"}
              </span>
            </div>
            <div
              aria-live="polite"
              className="h-[340px] overflow-y-auto border-y border-white/6 px-3 py-2"
            >
              {movePairs.length > 0 ? (
                <ol className="space-y-1">
                  {movePairs.map((pair, index) => (
                    <li
                      className={`grid grid-cols-[48px_1fr_1fr] items-center rounded-lg px-2 py-2 text-sm ${
                        index % 2 === 0 ? "bg-white/[0.025]" : ""
                      }`}
                      key={pair.number}
                    >
                      <span className="font-mono text-xs text-slate-500">
                        {pair.number}.
                      </span>
                      <span className="font-semibold text-slate-100">
                        {pair.white}
                      </span>
                      <span className="font-semibold text-slate-300">
                        {pair.black ?? "…"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-slate-800 text-slate-400">
                      <AlertTriangle aria-hidden="true" className="size-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300">
                      Chưa có nước đi
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Di chuyển quân cờ để bắt đầu ván đấu.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
              <span>{game.isCheck() ? "Đang chiếu!" : "Ván đấu đang diễn ra"}</span>
              <button
                aria-label="Bắt đầu ván mới"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
                onClick={handleNewGame}
                type="button"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Ván mới
              </button>
            </div>
          </div>

          <div
            aria-labelledby="chess-tab-chat"
            className={activeTab === "chat" ? "flex h-[432px] flex-col" : "hidden"}
            id="chess-panel-chat"
            role="tabpanel"
          >
            <div className="px-4 pb-3 pt-4">
              <h2 className="text-sm font-bold text-white">Trò chuyện</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Tin nhắn chỉ hiển thị trong phiên chơi này.
              </p>
            </div>
            <div
              aria-live="polite"
              className="flex-1 space-y-2 overflow-y-auto border-y border-white/6 px-3 py-3"
            >
              {chatMessages.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  Gửi lời chào hoặc một biểu cảm cho đối thủ.
                </p>
              ) : (
                chatMessages.map((message) => (
                  <div
                    className={`flex ${
                      message.sender === "white" ? "justify-start" : "justify-end"
                    }`}
                    key={message.id}
                  >
                    <p className="max-w-[85%] rounded-2xl bg-slate-800 px-3 py-2 text-sm text-slate-200">
                      {message.text}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Thả cảm xúc</span>
                {QUICK_REACTIONS.map((reaction) => (
                  <button
                    aria-label={`Gửi biểu cảm ${reaction}`}
                    className="grid size-8 place-items-center rounded-lg bg-slate-800 text-base transition hover:bg-slate-700"
                    key={reaction}
                    onClick={() => addReaction(reaction)}
                    type="button"
                  >
                    {reaction}
                  </button>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={handleChatSubmit}>
                <input
                  aria-label="Tin nhắn"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="Nhập tin nhắn..."
                  value={chatDraft}
                />
                <button
                  aria-label="Gửi tin nhắn"
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                  type="submit"
                >
                  <Send aria-hidden="true" className="size-4" />
                </button>
              </form>
            </div>
          </div>

          <div
            aria-labelledby="chess-tab-leaderboard"
            className={activeTab === "leaderboard" ? "block" : "hidden"}
            id="chess-panel-leaderboard"
            role="tabpanel"
          >
            <div className="px-4 pb-3 pt-4">
              <h2 className="text-sm font-bold text-white">Xếp hạng nhanh</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Elo cờ nhanh · người chơi nổi bật
              </p>
            </div>
            <ol className="space-y-1 border-y border-white/6 px-3 py-3">
              {[
                { name: "KnightRider", rating: "2,410", rank: "01" },
                { name: "EndgamePro", rating: "2,285", rank: "02" },
                { name: "QueenGambit", rating: "2,160", rank: "03" },
                { name: "Bạn", rating: "1,320", rank: "24" },
              ].map((player) => (
                <li
                  className="flex items-center justify-between rounded-xl px-2 py-2.5 hover:bg-white/[0.035]"
                  key={player.rank}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center font-mono text-xs font-bold ${
                        player.rank === "01"
                          ? "text-amber-300"
                          : "text-slate-500"
                      }`}
                    >
                      {player.rank}
                    </span>
                    <span className="grid size-8 place-items-center rounded-lg bg-slate-800">
                      {player.rank === "01" ? (
                        <Trophy aria-hidden="true" className="size-4 text-amber-300" />
                      ) : (
                        <Shield aria-hidden="true" className="size-4 text-slate-400" />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      {player.name}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-300">
                    {player.rating}
                  </span>
                </li>
              ))}
            </ol>
            <p className="px-4 py-3 text-xs text-slate-500">
              Bảng xếp hạng mẫu — có thể thay bằng dữ liệu từ A2OJ.
            </p>
          </div>
        </aside>
      </div>

      {result && (
        <div className="sr-only" role="status">
          {result.title} {result.description}
        </div>
      )}
      {!result && drawOffer === activeColor && (
        <span className="sr-only">
          {drawOffer === "w" ? whitePlayerName : blackPlayerName} đã xin hòa.
        </span>
      )}
    </section>
  );
}
