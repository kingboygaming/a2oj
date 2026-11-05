"use client";

import { Chess, type Square } from "chess.js";
import {
  AlertTriangle,
  ArrowDownUp,
  Bot,
  Check,
  Clock3,
  Crown,
  Flag,
  Handshake,
  MessageCircle,
  RotateCcw,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Chessboard } from "react-chessboard";
import { loadStockfishWorker } from "@/lib/chess-stockfish";
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

type PendingPremove = {
  from: Square;
  to: Square;
  promotion: "q";
};

type AnalyzableMove = {
  fen: string;
  san: string;
  uci: string;
};

type MoveAnalysis = AnalyzableMove & {
  recommendedSan: string | null;
};

type ChessArenaProps = {
  whitePlayerName?: string;
  blackPlayerName?: string;
  initialTimeSeconds?: number;
  incrementSeconds?: number;
  playerColor?: "w" | "b";
  canPlay?: boolean;
  clockRunning?: boolean;
  vsBot?: boolean;
  botLevel?: number;
  remoteAction?: ChessArenaRemoteAction | null;
  onMove?: (move: ChessArenaMove) => void;
  onGameAction?: (action: ChessArenaAction) => void;
};

type GameResult = {
  title: string;
  description: string;
  winner: "w" | "b" | null;
};

type PanelTab = "moves" | "chat" | "leaderboard" | "analysis";

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

function getPremovePosition(game: Chess, color: "w" | "b") {
  const fen = game.fen().split(" ");
  fen[1] = color;
  return new Chess(fen.join(" "), { skipValidation: true });
}

function getPremovePlanPosition(
  game: Chess,
  color: "w" | "b",
  premoves: PendingPremove[],
) {
  let position = getPremovePosition(game, color);

  for (const premove of premoves) {
    try {
      position.move(premove);
    } catch {
      return null;
    }

    if (position.isGameOver()) return null;
    const fen = position.fen().split(" ");
    fen[1] = color;
    position = new Chess(fen.join(" "), { skipValidation: true });
  }

  return position;
}

function findMove(position: Chess, source: Square, target: Square) {
  const legalMoves = position.moves({ verbose: true, square: source });
  const targetPiece = position.get(target);
  const castleMove =
    position.get(source)?.type === "k" &&
    targetPiece?.type === "r" &&
    targetPiece.color === position.turn()
      ? legalMoves.find((move) =>
          target[0] === "h"
            ? move.isKingsideCastle()
            : target[0] === "a" && move.isQueensideCastle(),
        )
      : undefined;
  return legalMoves.find((move) => move.to === target) ?? castleMove;
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
  onDismiss,
}: {
  result: GameResult;
  onNewGame: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      aria-labelledby="chess-result-title"
      aria-modal="true"
      className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-emerald-300/20 bg-slate-900 p-6 text-center shadow-2xl shadow-black/50 sm:p-8">
        <button
          aria-label="Đóng thông báo kết quả"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
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
  vsBot = false,
  botLevel = 6,
  remoteAction,
  onMove,
  onGameAction,
}: ChessArenaProps) {
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPremoves, setPendingPremoves] = useState<PendingPremove[]>([]);
  const [premoveEnabled, setPremoveEnabled] = useState(false);
  const [showResultModal, setShowResultModal] = useState(true);
  const [resultModalDismissed, setResultModalDismissed] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "loading" | "analyzing" | "complete" | "error"
  >("idle");
  const [analysisRows, setAnalysisRows] = useState<MoveAnalysis[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineStatus, setEngineStatus] = useState<"loading" | "ready" | "thinking" | "error">("loading");
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
  const pendingPremovesRef = useRef<PendingPremove[]>([]);
  const engineWorkerRef = useRef<Worker | null>(null);
  const engineReadyRef = useRef(false);
  const gameRef = useRef<Chess | null>(null);
  const moveHistoryRef = useRef(moveHistory);
  const searchFenRef = useRef<string | null>(null);
  const analysisRunIdRef = useRef(0);
  const analysisCleanupRef = useRef<(() => void) | null>(null);
  const premoveEnabledRef = useRef(premoveEnabled);
  const playerColorRef = useRef(playerColor);
  const incrementSecondsRef = useRef(incrementSeconds);
  const onGameActionRef = useRef(onGameAction);
  const onMoveRef = useRef(onMove);
  const executePendingPremoveRef = useRef(executePendingPremove);
  const applyEngineMoveRef = useRef(applyEngineMove);
  const recordMoveRef = useRef(recordMove);

  const game = useMemo(() => {
    const nextGame = new Chess();
    for (const san of moveHistory) nextGame.move(san);
    return nextGame;
  }, [moveHistory]);

  const activeColor = game.turn();
  gameRef.current = game;
  moveHistoryRef.current = moveHistory;
  premoveEnabledRef.current = premoveEnabled;
  playerColorRef.current = playerColor;
  incrementSecondsRef.current = incrementSeconds;
  onGameActionRef.current = onGameAction;
  onMoveRef.current = onMove;
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
  const displayedEngineStatus =
    !engineReady && engineStatus !== "error" ? "loading" : engineStatus;
  const lastMove = game.history({ verbose: true }).at(-1);
  const checkedKing = game.isCheck()
    ? game.findPiece({ type: "k", color: activeColor })[0]
    : undefined;

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const isPremoveTurn =
      premoveEnabled && playerColor !== undefined && activeColor !== playerColor;
    const planPosition =
      isPremoveTurn
        ? getPremovePlanPosition(game, playerColor ?? activeColor, pendingPremoves)
        : game;

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor:
          pendingPremoves.some((premove) => premove.from === selectedSquare)
            ? "rgb(168 85 247 / 48%)"
            : "rgb(250 204 21 / 48%)",
      };
      const previewGame = planPosition ?? game;
      const selectedPiece = previewGame.get(selectedSquare);
      for (const move of previewGame.moves({ verbose: true, square: selectedSquare })) {
        const target = previewGame.get(move.to);
        styles[move.to] = {
          ...(target
            ? {
                boxShadow: `inset 0 0 0 4px ${
                  selectedPiece?.color !== activeColor
                    ? "rgb(168 85 247 / 65%)"
                    : "rgb(34 197 94 / 65%)"
                }`,
              }
            : {
                backgroundImage:
                  `radial-gradient(circle, ${
                    selectedPiece?.color !== activeColor
                      ? "rgb(168 85 247 / 45%)"
                      : "rgb(15 23 42 / 32%)"
                  } 0 22%, transparent 24%)`,
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

    for (const premove of pendingPremoves) {
      styles[premove.from] = {
        ...styles[premove.from],
        backgroundColor: "rgb(168 85 247 / 42%)",
      };
      styles[premove.to] = {
        ...styles[premove.to],
        boxShadow: "inset 0 0 0 4px rgb(168 85 247 / 70%)",
      };
    }

    return styles;
  }, [
    activeColor,
    checkedKing,
    game,
    lastMove,
    pendingPremoves,
    playerColor,
    premoveEnabled,
    selectedSquare,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setPremoveEnabled(window.localStorage.getItem("a2oj.chess.premove") === "true");
        setShowResultModal(
          window.localStorage.getItem("a2oj.chess.showResultModal") !== "false",
        );
      } catch (error) {
        console.error("Could not read chess settings:", error);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!vsBot) {
      engineWorkerRef.current = null;
      engineReadyRef.current = false;
      return;
    }

    let cancelled = false;
    let worker: Worker | null = null;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "string") return;
      const line = event.data;
      if (line === "readyok") {
        engineReadyRef.current = true;
        setEngineReady(true);
        setEngineStatus("ready");
      } else if (line.startsWith("bestmove ")) {
        const bestMove = line.split(/\s+/)[1];
        const expectedFen = searchFenRef.current;
        const currentGame = gameRef.current;
        if (
          bestMove &&
          bestMove !== "(none)" &&
          currentGame &&
          expectedFen === currentGame.fen()
        ) {
          applyEngineMoveRef.current(bestMove);
        } else {
          setEngineStatus("ready");
        }
      }
    };
    const handleWorkerError = (event: ErrorEvent) => {
      console.error("Stockfish worker failed:", event.message);
      setEngineStatus("error");
    };

    void loadStockfishWorker()
      .then((readyWorker) => {
        if (cancelled) return;
        worker = readyWorker;
        engineWorkerRef.current = readyWorker;
        readyWorker.addEventListener("message", handleMessage);
        readyWorker.addEventListener("error", handleWorkerError);
        readyWorker.postMessage(
          `setoption name Skill Level value ${Math.max(0, Math.min(20, botLevel))}`,
        );
        readyWorker.postMessage("isready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Could not load Stockfish:", error);
        setEngineStatus("error");
      });

    return () => {
      cancelled = true;
      worker?.removeEventListener("message", handleMessage);
      worker?.removeEventListener("error", handleWorkerError);
      if (engineWorkerRef.current === worker) engineWorkerRef.current = null;
      engineReadyRef.current = false;
      searchFenRef.current = null;
      setEngineReady(false);
    };
  }, [botLevel, vsBot]);

  useEffect(() => {
    if (!vsBot || !engineReady || !engineReadyRef.current || result) return;
    const humanColor = playerColor ?? "w";
    if (activeColor === humanColor) return;

    const worker = engineWorkerRef.current;
    if (!worker) return;
    searchFenRef.current = game.fen();
    worker.postMessage(`position fen ${game.fen()}`);
    worker.postMessage("go movetime 900");
    setEngineStatus("thinking");
  }, [activeColor, engineReady, game, playerColor, result, vsBot]);

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
          recordMoveRef.current(nextGame, move, false);
          setSelectedSquare(null);
          executePendingPremoveRef.current(nextGame);
        } catch (error) {
          console.error("Received an invalid remote chess move:", error);
        }
        return;
      }

      if (action.type === "resign" || action.type === "timeout") {
        updatePendingPremoves([]);
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
        updatePendingPremoves([]);
        setManualResult({
          title: "Ván cờ hòa",
          description: "Hai người chơi đã đồng ý hòa.",
          winner: null,
        });
        setDrawOffer(null);
      } else if (action.type === "new-game") {
        stopAnalysis();
        setMoveHistory([]);
        setSelectedSquare(null);
        setResultModalDismissed(false);
        updatePendingPremoves([]);
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
    premoveEnabled,
    remoteAction,
    onGameAction,
    onMove,
    whitePlayerName,
  ]);

  function recordMove(nextGame: Chess, move: ReturnType<Chess["move"]>, notify: boolean) {
    setMoveHistory(nextGame.history());
    const gameResult = getGameResult(nextGame);
    setManualResult(gameResult);
    if (gameResult) updatePendingPremoves([]);
    if (incrementSecondsRef.current > 0) {
      (move.color === "w" ? setWhiteTime : setBlackTime)((seconds) =>
        seconds + incrementSecondsRef.current,
      );
    }
    if (notify) {
      onGameActionRef.current?.({ type: "move", san: move.san });
      onMoveRef.current?.({
        fen: nextGame.fen(),
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      });
    }
  }

  function updatePendingPremoves(premoves: PendingPremove[]) {
    pendingPremovesRef.current = premoves;
    setPendingPremoves(premoves);
  }

  function executePendingPremove(nextGame: Chess) {
    const [premove, ...remainingPremoves] = pendingPremovesRef.current;
    if (!premove) return false;

    if (
      !premoveEnabledRef.current ||
      !playerColorRef.current ||
      nextGame.isGameOver()
    ) {
      updatePendingPremoves([]);
      return false;
    }

    if (nextGame.turn() !== playerColorRef.current) return false;

    try {
      const move = nextGame.move(premove);
      updatePendingPremoves(remainingPremoves);
      recordMove(nextGame, move, true);
      setSelectedSquare(null);
      return true;
    } catch {
      return false;
    }
  }

  function applyEngineMove(uciMove: string) {
    const currentGame = gameRef.current;
    if (!currentGame || currentGame.isGameOver()) return;

    const parsedMove = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uciMove);
    if (!parsedMove) {
      setEngineStatus("error");
      return;
    }

    try {
      const nextGame = new Chess();
      for (const san of moveHistoryRef.current) nextGame.move(san);
      const move = nextGame.move({
        from: parsedMove[1] as Square,
        to: parsedMove[2] as Square,
        ...(parsedMove[3] ? { promotion: parsedMove[3] } : {}),
      });
      recordMoveRef.current(nextGame, move, false);
      executePendingPremove(nextGame);
      setSelectedSquare(null);
      setEngineStatus("ready");
    } catch (error) {
      console.error("Stockfish returned an invalid chess move:", error);
      setEngineStatus("error");
    }
  }

  executePendingPremoveRef.current = executePendingPremove;
  applyEngineMoveRef.current = applyEngineMove;
  recordMoveRef.current = recordMove;

  function makeMove(sourceSquare: string, targetSquare: string) {
    if (
      result ||
      !canPlay ||
      !isChessSquare(sourceSquare) ||
      !isChessSquare(targetSquare)
    ) {
      return false;
    }

    if (playerColor && playerColor !== activeColor) {
      if (!premoveEnabled) return false;
      const premoveGame = getPremovePlanPosition(
        game,
        playerColor,
        pendingPremovesRef.current,
      );
      if (premoveGame?.get(sourceSquare)?.color !== playerColor || !premoveGame) {
        return false;
      }
      const premove = findMove(premoveGame, sourceSquare, targetSquare);
      if (!premove) return false;
      const queued: PendingPremove = {
        from: premove.from,
        to: premove.to,
        promotion: "q",
      };
      updatePendingPremoves([...pendingPremovesRef.current, queued]);
      setSelectedSquare(null);
      return true;
    }

    const legalMove = findMove(game, sourceSquare, targetSquare);
    if (!legalMove) return false;
    if (drawOffer !== null && drawOffer !== game.turn()) setDrawOffer(null);

    const move = game.move({
      from: legalMove.from,
      to: legalMove.to,
      ...(legalMove.isPromotion() ? { promotion: "q" } : {}),
    });

    setSelectedSquare(null);
    updatePendingPremoves([]);
    recordMove(game, move, true);
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

    const premovePosition =
      playerColor && activeColor !== playerColor && premoveEnabled
        ? getPremovePlanPosition(game, playerColor, pendingPremoves)
        : null;
    const position = playerColor && activeColor !== playerColor && premoveEnabled
      ? premovePosition
      : game;
    if (!position) {
      setSelectedSquare(null);
      return;
    }
    const piece = position.get(square);
    const selectableColor =
      playerColor && activeColor !== playerColor && premoveEnabled
        ? playerColor
        : activeColor;
    setSelectedSquare(
      piece?.color === selectableColor &&
        (playerColor === undefined || piece.color === playerColor || playerColor === activeColor)
          ? square
          : null,
    );
  }

  function updatePremoveSetting(enabled: boolean) {
    setPremoveEnabled(enabled);
    try {
      window.localStorage.setItem("a2oj.chess.premove", String(enabled));
    } catch (error) {
      console.error("Could not save chess settings:", error);
    }
    if (!enabled) {
      updatePendingPremoves([]);
    }
  }

  function stopAnalysis() {
    analysisRunIdRef.current += 1;
    analysisCleanupRef.current?.();
    analysisCleanupRef.current = null;
    setAnalysisStatus("idle");
    setAnalysisRows([]);
    setAnalysisProgress(0);
  }

  async function startAnalysis() {
    if (!result) return;

    stopAnalysis();
    const runId = analysisRunIdRef.current;
    setActiveTab("analysis");
    if (moveHistory.length === 0) {
      setAnalysisStatus("complete");
      return;
    }

    const replay = new Chess();
    const moves: AnalyzableMove[] = [];

    try {
      for (const san of moveHistory) {
        const fen = replay.fen();
        const move = replay.move(san);
        moves.push({
          fen,
          san,
          uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        });
      }
    } catch (error) {
      console.error("Could not prepare chess game analysis:", error);
      setAnalysisStatus("error");
      return;
    }

    setAnalysisStatus("loading");

    try {
      const worker = await loadStockfishWorker();
      if (analysisRunIdRef.current !== runId) return;

      searchFenRef.current = null;
      let moveIndex = 0;
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        worker.postMessage("stop");
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        analysisCleanupRef.current = null;
        setAnalysisStatus("error");
      }, 30000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };
      const finish = (status: "complete" | "error") => {
        if (settled) return;
        settled = true;
        cleanup();
        analysisCleanupRef.current = null;
        setAnalysisStatus(status);
      };
      const analyzeCurrentMove = () => {
        const currentMove = moves[moveIndex];
        if (!currentMove) {
          finish("complete");
          return;
        }
        worker.postMessage(`position fen ${currentMove.fen}`);
        worker.postMessage("go depth 10");
        setAnalysisStatus("analyzing");
      };
      const handleMessage = (event: MessageEvent<unknown>) => {
        if (analysisRunIdRef.current !== runId || typeof event.data !== "string") {
          return;
        }
        if (event.data === "readyok") {
          analyzeCurrentMove();
          return;
        }
        if (!event.data.startsWith("bestmove ")) return;

        const currentMove = moves[moveIndex];
        if (!currentMove) {
          finish("complete");
          return;
        }

        const uci = event.data.split(/\s+/)[1];
        let recommendedSan: string | null = null;
        const parsed = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci ?? "");
        if (parsed) {
          try {
            const position = new Chess(currentMove.fen);
            recommendedSan = position.move({
              from: parsed[1] as Square,
              to: parsed[2] as Square,
              ...(parsed[3] ? { promotion: parsed[3] } : {}),
            }).san;
          } catch (error) {
            console.error("Stockfish suggested an invalid analysis move:", error);
          }
        }

        setAnalysisRows((rows) => [...rows, { ...currentMove, recommendedSan }]);
        moveIndex += 1;
        setAnalysisProgress(moveIndex);
        analyzeCurrentMove();
      };
      const handleError = (event: ErrorEvent) => {
        console.error("Stockfish analysis worker failed:", event.message);
        finish("error");
      };

      analysisCleanupRef.current = () => {
        if (!settled) worker.postMessage("stop");
        settled = true;
        cleanup();
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage("setoption name Skill Level value 20");
      worker.postMessage("ucinewgame");
      worker.postMessage("isready");
    } catch (error) {
      if (analysisRunIdRef.current !== runId) return;
      console.error("Could not start chess game analysis:", error);
      setAnalysisStatus("error");
    }
  }

  function updateResultModalSetting(enabled: boolean) {
    setShowResultModal(enabled);
    setResultModalDismissed(false);
    try {
      window.localStorage.setItem("a2oj.chess.showResultModal", String(enabled));
    } catch (error) {
      console.error("Could not save result display setting:", error);
    }
  }

  function handleDrawAction() {
    const offeringColor = playerColor ?? activeColor;
    if (drawOffer === offeringColor) {
      setDrawOffer(null);
      onGameAction?.({ type: "draw-cancel", color: offeringColor });
      return;
    }

    if (drawOffer !== null) {
      updatePendingPremoves([]);
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
    updatePendingPremoves([]);
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
    stopAnalysis();
    setMoveHistory([]);
    setSelectedSquare(null);
    setResultModalDismissed(false);
    updatePendingPremoves([]);
    setWhiteTime(initialTimeSeconds);
    setBlackTime(initialTimeSeconds);
    setManualResult(null);
    setResultModalDismissed(false);
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
    canDragPiece: ({ square }: { square: string | null }) => {
      if (!square || !isChessSquare(square) || result || !canPlay) return false;
      const pieceColor = game.get(square)?.color;
      return (
        pieceColor === activeColor &&
        (playerColor === undefined || playerColor === activeColor)
      ) || (
        premoveEnabled &&
        playerColor !== undefined &&
        activeColor !== playerColor &&
        pieceColor === playerColor
      );
    },
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
          {vsBot
            ? displayedEngineStatus === "loading"
              ? "Đang tải Stockfish..."
              : displayedEngineStatus === "thinking"
                ? "Stockfish đang tính..."
                : displayedEngineStatus === "error"
                  ? "Lỗi tải Stockfish"
                  : "Đấu với Stockfish"
            : playerColor
              ? "Ván đấu online"
              : "Ván đấu cục bộ"}
        </span>
        <button
          aria-label="Cài đặt cờ vua"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <Settings aria-hidden="true" className="size-4" />
          Cài đặt
        </button>
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
            {result && showResultModal && !resultModalDismissed && (
              <ResultModal
                result={result}
                onDismiss={() => setResultModalDismissed(true)}
                onNewGame={handleNewGame}
              />
            )}
          </div>
          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{result.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{result.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/15"
                  onClick={() => void startAnalysis()}
                  type="button"
                >
                  <Sparkles aria-hidden="true" className="size-4" />
                  Phân tích ván
                </button>
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-emerald-300"
                  onClick={handleNewGame}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Ván mới
                </button>
              </div>
            </div>
          )}
          <p className="px-1 text-xs leading-5 text-slate-500">
            Kéo quân hoặc chạm quân rồi chạm ô đích. Nhập thành bằng cách đi vua
            hai ô hoặc kéo vua vào ô xe. Bắt tốt qua đường được phép ngay sau khi
            đối thủ tiến tốt hai ô. Khi bật premove, có thể xếp nhiều nước trước
            và hủy cả hàng đợi bất cứ lúc nào.
          </p>
          {pendingPremoves.length > 0 && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-purple-300/20 bg-purple-300/10 px-3 py-2 text-sm text-purple-100">
              <span className="min-w-0">
                <span className="font-semibold">
                  Hàng đợi premove ({pendingPremoves.length}):
                </span>{" "}
                {pendingPremoves.map((premove, index) => (
                  <span key={`${premove.from}-${premove.to}-${index}`}>
                    {index > 0 ? " · " : ""}
                    {premove.from} → {premove.to}
                  </span>
                ))}
              </span>
              <button
                className="text-xs font-bold text-purple-200 underline"
                onClick={() => updatePendingPremoves([])}
                type="button"
              >
                Hủy tất cả
              </button>
            </div>
          )}

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
            className="grid grid-cols-4 border-b border-white/8 p-1.5"
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
              aria-controls="chess-panel-analysis"
              aria-selected={activeTab === "analysis"}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === "analysis"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={!result}
              onClick={() => setActiveTab("analysis")}
              id="chess-tab-analysis"
              role="tab"
              type="button"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Phân tích
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
            aria-labelledby="chess-tab-analysis"
            className={activeTab === "analysis" ? "block" : "hidden"}
            id="chess-panel-analysis"
            role="tabpanel"
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
              <div>
                <h2 className="text-sm font-bold text-white">Phân tích bằng Stockfish</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  So sánh từng nước với lựa chọn tốt nhất của engine.
                </p>
              </div>
              {analysisStatus !== "analyzing" && analysisStatus !== "loading" && (
                <button
                  className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300"
                  disabled={!result || moveHistory.length === 0}
                  onClick={() => void startAnalysis()}
                  type="button"
                >
                  {analysisStatus === "complete" ? "Phân tích lại" : "Bắt đầu"}
                </button>
              )}
              {(analysisStatus === "analyzing" || analysisStatus === "loading") && (
                <button
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
                  onClick={stopAnalysis}
                  type="button"
                >
                  Hủy
                </button>
              )}
            </div>
            <div className="h-[340px] overflow-y-auto border-y border-white/6 px-3 py-3">
              {analysisStatus === "idle" && (
                <p className="py-12 text-center text-xs text-slate-500">
                  Bắt đầu phân tích để xem gợi ý Stockfish cho từng nước đi.
                </p>
              )}
              {(analysisStatus === "loading" || analysisStatus === "analyzing") && (
                <p aria-live="polite" className="py-12 text-center text-sm text-sky-200">
                  {analysisStatus === "loading"
                    ? "Đang khởi tạo Stockfish..."
                    : `Đang phân tích nước ${analysisProgress + 1}/${moveHistory.length}...`}
                </p>
              )}
              {analysisStatus === "error" && (
                <p className="py-12 text-center text-sm text-rose-200" role="alert">
                  Không thể hoàn tất phân tích. Hãy thử lại.
                </p>
              )}
              {analysisRows.length > 0 && (
                <ol className="space-y-1">
                  {analysisRows.map((row, index) => (
                    <li
                      className="grid grid-cols-[36px_minmax(42px,0.6fr)_minmax(0,1.4fr)] items-center gap-2 rounded-lg bg-white/[0.025] px-2 py-2 text-xs"
                      key={`${index}-${row.uci}`}
                    >
                      <span className="font-mono text-slate-500">
                        {Math.floor(index / 2) + 1}{index % 2 === 0 ? "." : "..."}
                      </span>
                      <span className="font-bold text-white">{row.san}</span>
                      <span className={row.recommendedSan === row.san ? "text-emerald-300" : "text-amber-200"}>
                        {row.recommendedSan === row.san
                          ? "Nước tốt nhất"
                          : row.recommendedSan
                            ? `Engine đề xuất ${row.recommendedSan}`
                            : "Không có gợi ý"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {analysisStatus === "complete" && analysisRows.length === 0 && (
                <p className="py-12 text-center text-xs text-slate-500">
                  Ván đấu không có nước đi để phân tích.
                </p>
              )}
              {analysisStatus === "complete" && analysisRows.length > 0 && (
                <p className="pt-3 text-center text-xs text-slate-500">
                  Đã phân tích {analysisRows.length}/{moveHistory.length} nước.
                </p>
              )}
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
      {settingsOpen && (
        <div
          aria-labelledby="chess-settings-title"
          aria-modal="true"
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white" id="chess-settings-title">
                  Cài đặt cờ vua
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tùy chỉnh thao tác trong ván đấu này và các ván sau.
                </p>
              </div>
              <button
                aria-label="Đóng cài đặt"
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-slate-950/50 p-4">
              <input
                checked={premoveEnabled}
                className="mt-1 size-4 accent-emerald-400"
                onChange={(event) => updatePremoveSetting(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-bold text-white">Bật premove</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  Xếp trước nhiều nước khi đang đến lượt đối thủ. Mỗi nước chỉ được
                  thực hiện nếu vẫn hợp lệ trên bàn cờ thực; có thể hủy cả hàng đợi.
                </span>
              </span>
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-slate-950/50 p-4">
              <input
                checked={showResultModal}
                className="mt-1 size-4 accent-emerald-400"
                onChange={(event) => updateResultModalSetting(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-bold text-white">
                  Hiện thông báo kết quả
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  Tắt để không mở hộp kết quả phủ lên bàn cờ khi ván đấu kết thúc.
                </span>
              </span>
            </label>

            {vsBot && (
              <p className="mt-4 rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-xs leading-5 text-sky-100/80">
                <Bot aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
                Stockfish 19 chạy cục bộ trong Web Worker; độ khó hiện tại là cấp{" "}
                {botLevel}/20. Ván đấu không gửi trạng thái bàn cờ lên máy chủ.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
