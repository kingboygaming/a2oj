"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Bot,
  Clock3,
  Copy,
  DoorOpen,
  LoaderCircle,
  Radio,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { preloadStockfish } from "@/lib/chess-stockfish";
import {
  CHESS_TIME_CONTROLS,
  getChessTimeControl,
  type ChessTimeControl,
} from "@/lib/chess-time-controls";
import {
  ChessArena,
  type ChessArenaAction,
  type ChessArenaRemoteAction,
} from "@/components/ChessArena";

type LobbyRoom = {
  playerId: string;
  accountUserId: string | null;
  roomId: string;
  playerName: string;
  timeControlId: string;
  createdAt: number;
  isOpen: boolean;
  isRandom: boolean;
  isRated: boolean;
};

type RoomSession = {
  roomId: string;
  role: "host" | "guest";
  timeControlId: string;
  playerName: string;
  opponentName: string;
  started: boolean;
  isRandom: boolean;
  isRated: boolean;
};

type LocalGame = ChessTimeControl & {
  mode: "local" | "bot";
  botLevel: number;
};

type RoomMessage =
  | {
      type: "join";
      playerId: string;
      accountUserId: string | null;
      playerName: string;
      roomId: string;
    }
  | {
      type: "welcome";
      playerId: string;
      targetPlayerId: string;
      accountUserId: string | null;
      playerName: string;
      timeControlId: string;
      isRated: boolean;
    }
  | {
      type: "full";
      playerId: string;
      targetPlayerId: string;
    }
  | {
      type: "leave";
      playerId: string;
    }
  | {
      type: "action";
      playerId: string;
      action: ChessArenaAction;
      actionId: string;
    };

function preloadStockfishForBot() {
  void preloadStockfish().catch((error: unknown) =>
    console.error("Could not preload Stockfish:", error),
  );
}

function isLobbyRoom(value: unknown): value is LobbyRoom {
  if (!value || typeof value !== "object") return false;
  const room = value as Partial<LobbyRoom>;
  return (
    typeof room.playerId === "string" &&
    (room.accountUserId === null || typeof room.accountUserId === "string") &&
    typeof room.roomId === "string" &&
    /^[a-f0-9]{10}$/.test(room.roomId) &&
    typeof room.playerName === "string" &&
    room.playerName.length <= 24 &&
    typeof room.timeControlId === "string" &&
    getChessTimeControl(room.timeControlId) !== null &&
    typeof room.createdAt === "number" &&
    Number.isFinite(room.createdAt) &&
    typeof room.isOpen === "boolean" &&
    typeof room.isRandom === "boolean" &&
    typeof room.isRated === "boolean"
  );
}

function isChessArenaAction(value: unknown): value is ChessArenaAction {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const action = value as Partial<ChessArenaAction>;
  if (action.type === "move") return typeof action.san === "string";
  if (
    action.type === "resign" ||
    action.type === "timeout" ||
    action.type === "draw-offer" ||
    action.type === "draw-cancel"
  ) {
    return action.color === "w" || action.color === "b";
  }
  return action.type === "draw-accept" || action.type === "new-game";
}

function getRoomMessages(channel: RealtimeChannel) {
  return channel.presenceState<LobbyRoom>();
}

export function ChessLobby({
  accountUserId,
  canPlayRated,
  initialPlayerName,
}: {
  accountUserId: string | null;
  canPlayRated: boolean;
  initialPlayerName: string;
}) {
  const [playerId] = useState(() => crypto.randomUUID());
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [selectedTimeControlId, setSelectedTimeControlId] = useState("blitz-5");
  const [customMinutes, setCustomMinutes] = useState("5");
  const [customIncrement, setCustomIncrement] = useState("0");
  const [isRated, setIsRated] = useState(false);
  const [openRooms, setOpenRooms] = useState<LobbyRoom[]>([]);
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);
  const [localGame, setLocalGame] = useState<LocalGame | null>(null);
  const [botLevel, setBotLevel] = useState(2);
  const [remoteAction, setRemoteAction] = useState<ChessArenaRemoteAction | null>(null);
  const [realtimeConnection, setRealtimeConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [ratedSyncFailed, setRatedSyncFailed] = useState(false);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const roomSessionRef = useRef<RoomSession | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const opponentAccountIdRef = useRef<string | null>(null);
  const hasProcessedInviteRef = useRef(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasRealtimeConfig = Boolean(supabaseUrl && supabaseKey);
  const realtimeStatus = hasRealtimeConfig ? realtimeConnection : "offline";

  const selectedTimeControl =
    getChessTimeControl(selectedTimeControlId) ??
    CHESS_TIME_CONTROLS.find((control) => control.id === "blitz-5")!;
  const parsedCustomMinutes = Number(customMinutes);
  const parsedCustomIncrement = Number(customIncrement);
  const customTimeControlId =
    Number.isInteger(parsedCustomMinutes) &&
    parsedCustomMinutes >= 1 &&
    parsedCustomMinutes <= 180 &&
    Number.isInteger(parsedCustomIncrement) &&
    parsedCustomIncrement >= 0 &&
    parsedCustomIncrement <= 60
      ? `custom-${parsedCustomMinutes}-${parsedCustomIncrement}`
      : null;
  const isSelectedTimeControlValid =
    !selectedTimeControlId.startsWith("custom-") ||
    selectedTimeControlId === customTimeControlId;
  const activeTimeControl = roomSession
    ? getChessTimeControl(roomSession.timeControlId) ?? selectedTimeControl
    : localGame;

  useEffect(() => {
    roomSessionRef.current = roomSession;
  }, [roomSession]);

  const refreshOpenRooms = useCallback((channel: RealtimeChannel) => {
    const rooms = Object.values(getRoomMessages(channel))
      .flat()
      .filter(isLobbyRoom)
      .filter((room) => room.isOpen && Date.now() - room.createdAt < 2 * 60 * 60 * 1000)
      .sort((left, right) => left.createdAt - right.createdAt);
    setOpenRooms(rooms);
  }, []);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    supabaseRef.current = supabase;
    const channel = supabase.channel("chess:lobby", {
      config: { presence: { key: playerId }, broadcast: { self: false } },
    });
    lobbyChannelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => refreshOpenRooms(channel));
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeConnection("connected");
        refreshOpenRooms(channel);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeConnection("offline");
        setNotice("Không thể kết nối Supabase Realtime. Hãy thử tải lại trang.");
      }
    });

    return () => {
      lobbyChannelRef.current = null;
      supabaseRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [playerId, refreshOpenRooms, supabaseKey, supabaseUrl]);

  const trackHostedRoom = useCallback(
    async (session: RoomSession, isOpen: boolean) => {
      const channel = lobbyChannelRef.current;
      if (!channel || session.role !== "host") return;
      const result = await channel.track({
        playerId,
        accountUserId,
        roomId: session.roomId,
        playerName: session.playerName,
        timeControlId: session.timeControlId,
        createdAt: Date.now(),
        isOpen,
        isRandom: session.isRandom,
        isRated: session.isRated,
      } satisfies LobbyRoom);
      if (result !== "ok") {
        setNotice("Không thể cập nhật trạng thái phòng trong danh sách.");
      }
    },
    [accountUserId, playerId],
  );

  const leaveRoom = useCallback(async () => {
    const session = roomSessionRef.current;
    const channel = roomChannelRef.current;
    if (session?.role === "guest" && channel) {
      await channel.send({
        type: "broadcast",
        event: "chess",
        payload: { type: "leave", playerId } satisfies RoomMessage,
      });
    }
    if (session?.role === "host") {
      await lobbyChannelRef.current?.untrack();
    }
    if (channel && supabaseRef.current) {
      await supabaseRef.current.removeChannel(channel);
      roomChannelRef.current = null;
    }
    opponentIdRef.current = null;
    opponentAccountIdRef.current = null;
    roomSessionRef.current = null;
    setRoomSession(null);
    setRemoteAction(null);
    setRatedSyncFailed(false);
    setNotice("");
    setBusy(false);
    window.history.replaceState(null, "", "/chess");
  }, [playerId]);

  const joinRoom = useCallback(
    async (room: LobbyRoom) => {
      if (!playerId || !room.roomId || !room.isOpen) return;
      if (room.playerId === playerId) {
        setNotice("Đây là phòng của bạn. Hãy chia sẻ liên kết để mời đối thủ.");
        return;
      }
      if (room.isRated && !canPlayRated) {
        setNotice("Đăng nhập tài khoản học sinh để tham gia trận có xếp hạng.");
        return;
      }
      if (realtimeStatus !== "connected") {
        setNotice("Cần kết nối Supabase Realtime để tham gia phòng online.");
        return;
      }

      setBusy(true);
      let joinedTimeControlId = room.timeControlId;
      if (room.isRated) {
        try {
          const response = await fetch("/api/chess/matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join", roomId: room.roomId }),
          });
          const data: unknown = await response.json();
          if (!response.ok) {
            const error =
              typeof data === "object" &&
              data !== null &&
              "error" in data &&
              typeof data.error === "string"
                ? data.error
                : "Không thể tham gia trận xếp hạng.";
            throw new Error(error);
          }
          if (
            typeof data !== "object" ||
            data === null ||
            !("timeControlId" in data) ||
            typeof data.timeControlId !== "string" ||
            !("rated" in data) ||
            data.rated !== true ||
            !("whiteUserId" in data) ||
            typeof data.whiteUserId !== "string" ||
            (room.accountUserId !== null && data.whiteUserId !== room.accountUserId)
          ) {
            throw new Error("Máy chủ trả về thông tin trận không hợp lệ.");
          }
          joinedTimeControlId = data.timeControlId;
          opponentAccountIdRef.current = data.whiteUserId;
        } catch (error) {
          setBusy(false);
          setNotice(
            error instanceof Error ? error.message : "Không thể tham gia trận xếp hạng.",
          );
          return;
        }
      }

      opponentIdRef.current = null;
      if (!room.isRated) opponentAccountIdRef.current = null;
      const session: RoomSession = {
        roomId: room.roomId,
        role: "guest",
        timeControlId: joinedTimeControlId,
        playerName: playerName.trim() || "Người chơi",
        opponentName: room.playerName,
        started: false,
        isRandom: room.isRandom,
        isRated: room.isRated,
      };
      roomSessionRef.current = session;
      setRoomSession(session);
      setLocalGame(null);
      setRemoteAction(null);
      setRatedSyncFailed(false);
      setNotice("");
      setBusy(true);
      const inviteQuery = room.isRated ? "&rated=1" : "";
      window.history.replaceState(
        null,
        "",
        `/chess?room=${encodeURIComponent(room.roomId)}${inviteQuery}`,
      );
    },
    [canPlayRated, playerId, playerName, realtimeStatus],
  );

  const createRoom = useCallback(
    async (
      isRandom: boolean,
      timeControlId = selectedTimeControlId,
      rated = isRated,
    ) => {
      if (realtimeStatus !== "connected" || !playerId) {
        setNotice("Cần kết nối Supabase Realtime để tạo phòng online.");
        return;
      }
      if (rated && !canPlayRated) {
        setNotice("Đăng nhập tài khoản học sinh để tạo trận có xếp hạng.");
        return;
      }
      setBusy(true);
      const session: RoomSession = {
        roomId: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
        role: "host",
        timeControlId,
        playerName: playerName.trim() || "Người chơi",
        opponentName: "Đang chờ đối thủ...",
        started: false,
        isRandom,
        isRated: rated,
      };
      if (rated) {
        try {
          const response = await fetch("/api/chess/matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              roomId: session.roomId,
              timeControlId,
            }),
          });
          const data: unknown = await response.json();
          if (!response.ok) {
            const error =
              typeof data === "object" &&
              data !== null &&
              "error" in data &&
              typeof data.error === "string"
                ? data.error
                : "Không thể tạo trận xếp hạng.";
            throw new Error(error);
          }
        } catch (error) {
          setBusy(false);
          setNotice(
            error instanceof Error ? error.message : "Không thể tạo trận xếp hạng.",
          );
          return;
        }
      }
      opponentIdRef.current = null;
      roomSessionRef.current = session;
      setRoomSession(session);
      setLocalGame(null);
      setRatedSyncFailed(false);
      setNotice(
        isRandom
          ? "Đang chờ đối thủ phù hợp. Người chơi khác có thể ghép với bạn."
          : "",
      );
      window.history.replaceState(
        null,
        "",
        `/chess?room=${encodeURIComponent(session.roomId)}${rated ? "&rated=1" : ""}`,
      );
    },
    [canPlayRated, isRated, playerId, playerName, realtimeStatus, selectedTimeControlId],
  );

  const findRandomMatch = useCallback(() => {
    const match = openRooms.find(
      (room) =>
        room.playerId !== playerId &&
        room.timeControlId === selectedTimeControlId &&
        room.isRated === isRated &&
        room.isOpen,
    );
    if (match) {
      joinRoom(match);
      return;
    }
    void createRoom(true, selectedTimeControlId);
  }, [createRoom, isRated, joinRoom, openRooms, playerId, selectedTimeControlId]);

  useEffect(() => {
    if (hasProcessedInviteRef.current || realtimeStatus !== "connected") return;
    const timer = window.setTimeout(() => {
      const roomId = new URLSearchParams(window.location.search).get("room");
      if (!roomId) return;
      hasProcessedInviteRef.current = true;
      if (!/^[a-f0-9]{10}$/.test(roomId)) {
        setNotice("Liên kết phòng không hợp lệ.");
        return;
      }
      const inviteRoom: LobbyRoom = {
        playerId: "",
        accountUserId: null,
        roomId,
        playerName: "Chủ phòng",
        timeControlId: selectedTimeControlId,
        createdAt: Date.now(),
        isOpen: true,
        isRandom: false,
        isRated: new URLSearchParams(window.location.search).get("rated") === "1",
      };
      const knownRoom = openRooms.find((room) => room.roomId === roomId);
      joinRoom(knownRoom ?? inviteRoom);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [joinRoom, openRooms, realtimeStatus, selectedTimeControlId]);

  useEffect(() => {
    if (!roomSession?.roomId || !playerId || !supabaseRef.current) return;
    const session = roomSessionRef.current;
    if (!session) return;
    const supabase = supabaseRef.current;
    const channel = supabase.channel(`chess:room:${session.roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: playerId },
      },
    });
    roomChannelRef.current = channel;

    channel.on("broadcast", { event: "chess" }, ({ payload }) => {
      if (!payload || typeof payload !== "object" || !("type" in payload)) return;
      const message = payload as Partial<RoomMessage>;
      if (message.playerId === playerId) return;

      if (message.type === "join" && session.role === "host") {
        if (
          typeof message.playerId !== "string" ||
          typeof message.playerName !== "string" ||
          message.roomId !== session.roomId ||
          (message.accountUserId !== null &&
            typeof message.accountUserId !== "string")
        ) {
          return;
        }
        const joiningPlayerId = message.playerId;
        const joiningPlayerName = message.playerName;
        const joiningAccountUserId = message.accountUserId ?? null;
        if (opponentIdRef.current && opponentIdRef.current !== message.playerId) {
          void channel.send({
            type: "broadcast",
            event: "chess",
            payload: {
              type: "full",
              playerId,
              targetPlayerId: message.playerId,
            } satisfies RoomMessage,
          });
          return;
        }
        const acceptOpponent = () => {
          opponentIdRef.current = joiningPlayerId;
          opponentAccountIdRef.current = joiningAccountUserId;
          const activeSession = roomSessionRef.current;
          if (!activeSession) return;
          const startedSession = {
            ...activeSession,
            opponentName: joiningPlayerName,
            started: true,
          };
          roomSessionRef.current = startedSession;
          setRoomSession(startedSession);
          void trackHostedRoom(startedSession, false);
          void channel.send({
            type: "broadcast",
            event: "chess",
            payload: {
              type: "welcome",
              playerId,
              targetPlayerId: joiningPlayerId,
              accountUserId,
              playerName: activeSession.playerName,
              timeControlId: activeSession.timeControlId,
              isRated: activeSession.isRated,
            } satisfies RoomMessage,
          });
          setNotice("");
        };

        if (session.isRated) {
          if (!accountUserId || !joiningAccountUserId) {
            setNotice("Chỉ tài khoản học sinh đã đăng nhập mới có thể tham gia trận rated.");
            return;
          }
          void fetch(`/api/chess/matches?roomId=${encodeURIComponent(session.roomId)}`)
            .then(async (response) => {
              const data: unknown = await response.json();
              if (
                !response.ok ||
                typeof data !== "object" ||
                data === null ||
                !("whiteUserId" in data) ||
                data.whiteUserId !== accountUserId ||
                !("blackUserId" in data) ||
                data.blackUserId !== joiningAccountUserId ||
                !("status" in data) ||
                data.status !== "IN_PROGRESS"
              ) {
                throw new Error("Tài khoản đối thủ không khớp với trận rated.");
              }
              acceptOpponent();
            })
            .catch((error: unknown) => {
              console.error("Could not verify rated chess opponent:", error);
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Không thể xác minh tài khoản đối thủ.",
              );
            });
        } else {
          acceptOpponent();
        }
        return;
      }

      if (
        message.type === "welcome" &&
        session.role === "guest" &&
        message.targetPlayerId === playerId &&
        typeof message.playerName === "string" &&
        typeof message.timeControlId === "string" &&
        getChessTimeControl(message.timeControlId) !== null &&
        message.isRated === session.isRated &&
        (session.isRated
          ? message.accountUserId === opponentAccountIdRef.current
          : true) &&
        (!opponentIdRef.current || message.playerId === opponentIdRef.current)
      ) {
        const startedSession = {
          ...roomSessionRef.current!,
          opponentName: message.playerName,
          timeControlId: message.timeControlId,
          started: true,
        };
        if (typeof message.playerId === "string") {
          opponentIdRef.current = message.playerId;
        }
        roomSessionRef.current = startedSession;
        setRoomSession(startedSession);
        setBusy(false);
        setNotice("");
        return;
      }

      if (
        message.type === "full" &&
        session.role === "guest" &&
        message.targetPlayerId === playerId
      ) {
        void leaveRoom().then(() =>
          setNotice("Phòng vừa có người chơi khác tham gia. Chọn phòng khác để chơi."),
        );
        return;
      }

      if (
        message.type === "leave" &&
        session.role === "host" &&
        message.playerId === opponentIdRef.current
      ) {
        opponentIdRef.current = null;
        opponentAccountIdRef.current = null;
        const activeSession = roomSessionRef.current;
        if (!activeSession) return;
        const waitingSession = {
          ...activeSession,
          opponentName: activeSession.isRated
            ? "Đối thủ đã mất kết nối"
            : "Đang chờ đối thủ...",
          started: false,
        };
        roomSessionRef.current = waitingSession;
        setRoomSession(waitingSession);
        void trackHostedRoom(waitingSession, !waitingSession.isRated);
        if (waitingSession.isRated) {
          setNotice("Trận rated tạm dừng chờ đối thủ kết nối lại.");
        }
        return;
      }

      if (
        message.type === "action" &&
        typeof message.playerId === "string" &&
        message.playerId === opponentIdRef.current &&
        typeof message.actionId === "string" &&
        isChessArenaAction(message.action)
      ) {
        setRemoteAction({ id: message.actionId, action: message.action });
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const trackResult = await channel.track({
          playerId,
            accountUserId,
          roomId: session.roomId,
          role: session.role,
          playerName: session.playerName,
        });
        if (trackResult !== "ok") {
          setNotice("Không thể đăng ký người chơi trong phòng. Hãy thử lại.");
          setBusy(false);
          return;
        }
        if (session.role === "host") {
          await trackHostedRoom(session, true);
          setBusy(false);
        } else {
          const sendResult = await channel.send({
            type: "broadcast",
            event: "chess",
            payload: {
              type: "join",
              playerId,
              accountUserId,
              playerName: session.playerName,
              roomId: session.roomId,
            } satisfies RoomMessage,
          });
          if (sendResult !== "ok") {
            setNotice("Không gửi được yêu cầu tham gia phòng. Hãy thử lại.");
            setBusy(false);
          }
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setNotice("Mất kết nối với phòng. Hãy kiểm tra mạng rồi tải lại trang.");
        setBusy(false);
      }
    });

    return () => {
      if (roomChannelRef.current === channel) roomChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [accountUserId, leaveRoom, playerId, roomSession?.role, roomSession?.roomId, trackHostedRoom]);

  const sendGameAction = useCallback(
    (action: ChessArenaAction) => {
      const channel = roomChannelRef.current;
      const session = roomSessionRef.current;
      if (!channel) {
        setNotice("Phòng chưa kết nối; nước đi chưa được gửi tới đối thủ.");
        return;
      }
      void (async () => {
        let acceptedAction = action;
        if (session?.isRated) {
          let data: unknown;
          for (let attempt = 0; attempt < 20; attempt += 1) {
            const response = await fetch(
              `/api/chess/matches/${encodeURIComponent(session.roomId)}/action`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(action),
              },
            );
            data = await response.json();
            if (!response.ok) {
              const error =
                typeof data === "object" &&
                data !== null &&
                "error" in data &&
                typeof data.error === "string"
                  ? data.error
                  : "Máy chủ chưa chấp nhận hành động rated.";
              throw new Error(error);
            }
            if (
              action.type !== "timeout" ||
              typeof data !== "object" ||
              data === null ||
              !("pendingTimeout" in data) ||
              data.pendingTimeout !== true
            ) {
              break;
            }
            await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
          }
          if (
            action.type === "timeout" &&
            typeof data === "object" &&
            data !== null &&
            "pendingTimeout" in data &&
            data.pendingTimeout === true
          ) {
            throw new Error("Chưa xác nhận được thời gian hết cờ. Hãy thử tải lại ván đấu.");
          }
          if (typeof data === "object" && data !== null && "action" in data) {
            const serverAction = data.action;
            if (isChessArenaAction(serverAction)) acceptedAction = serverAction;
          }
          if (
            action.type === "move" &&
            typeof data === "object" &&
            data !== null &&
            "san" in data &&
            typeof data.san === "string"
          ) {
            acceptedAction = { type: "move", san: data.san };
          }
          if (
            typeof data === "object" &&
            data !== null &&
            "whiteRatingChange" in data &&
            typeof data.whiteRatingChange === "number" &&
            "blackRatingChange" in data &&
            typeof data.blackRatingChange === "number"
          ) {
            const ownChange =
              session.role === "host"
                ? data.whiteRatingChange
                : data.blackRatingChange;
            setNotice(`Trận đã xếp hạng. Elo của bạn ${ownChange >= 0 ? "+" : ""}${ownChange}.`);
          }
        }

        const message: RoomMessage = {
          type: "action",
          playerId,
          action: acceptedAction,
          actionId: crypto.randomUUID(),
        };
        const result = await channel.send({
          type: "broadcast",
          event: "chess",
          payload: message,
        });
        if (result !== "ok") throw new Error("Không đồng bộ được hành động với đối thủ.");
      })().catch((error: unknown) => {
        console.error("Could not synchronize chess action:", error);
        setNotice(
          error instanceof Error ? error.message : "Không đồng bộ được hành động với đối thủ.",
        );
        if (session?.isRated) setRatedSyncFailed(true);
      });
    },
    [playerId],
  );

  const copyRoomLink = useCallback(async () => {
    if (!roomSession) return;
    const url = new URL("/chess", window.location.origin);
    url.searchParams.set("room", roomSession.roomId);
    if (roomSession.isRated) url.searchParams.set("rated", "1");
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Đã sao chép liên kết phòng.");
    } catch (error) {
      console.error("Could not copy chess room link:", error);
      setNotice("Không thể sao chép tự động. Hãy sao chép liên kết trên thanh địa chỉ.");
    }
  }, [roomSession]);

  if (roomSession && activeTimeControl) {
    return (
      <main className="mx-auto w-full max-w-7xl text-slate-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="grid size-10 place-items-center rounded-xl border border-white/10 bg-slate-900 text-slate-300 transition hover:bg-slate-800"
              onClick={() => void leaveRoom()}
              type="button"
              aria-label="Rời phòng cờ"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                {roomSession.isRandom ? "Ghép ngẫu nhiên" : "Phòng cờ vua"}
              </p>
              <p className="font-mono text-sm text-slate-300">
                Mã phòng: {roomSession.roomId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roomSession.isRated && (
              <span className="inline-flex min-h-10 items-center rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-bold uppercase tracking-wide text-amber-100">
                Rated · Elo
              </span>
            )}
            {roomSession.role === "host" && (
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                onClick={() => void copyRoomLink()}
                type="button"
              >
                <Copy aria-hidden="true" className="size-4" />
                Chia sẻ phòng
              </button>
            )}
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-slate-300">
              <Clock3 aria-hidden="true" className="size-4 text-emerald-300" />
              {activeTimeControl.label} {activeTimeControl.name}
            </span>
          </div>
        </div>

        {notice && (
          <p
            className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            {notice}
          </p>
        )}

        {!roomSession.started && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang chờ đối thủ tham gia. Chia sẻ mã phòng hoặc chờ ghép ngẫu nhiên.
          </div>
        )}

        {(roomSession.role === "host" || roomSession.started) && (
          <ChessArena
            whitePlayerName={
              roomSession.role === "host"
                ? roomSession.playerName
                : roomSession.opponentName
            }
            blackPlayerName={
              roomSession.role === "host"
                ? roomSession.opponentName
                : roomSession.playerName
            }
            initialTimeSeconds={activeTimeControl.initialSeconds}
            incrementSeconds={activeTimeControl.incrementSeconds}
            playerColor={roomSession.role === "host" ? "w" : "b"}
            clockRunning={roomSession.started && !ratedSyncFailed}
            canPlay={roomSession.started && !ratedSyncFailed}
            remoteAction={remoteAction}
            onGameAction={sendGameAction}
          />
        )}
      </main>
    );
  }

  if (localGame) {
    return (
      <main className="mx-auto w-full max-w-7xl">
        <button
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          onClick={() => setLocalGame(null)}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại sảnh cờ
        </button>
        <ChessArena
          initialTimeSeconds={localGame.initialSeconds}
          incrementSeconds={localGame.incrementSeconds}
          vsBot={localGame.mode === "bot"}
          botLevel={localGame.botLevel}
          playerColor={localGame.mode === "bot" ? "w" : undefined}
          whitePlayerName={playerName.trim() || "Người chơi"}
          blackPlayerName={
            localGame.mode === "bot"
              ? `Stockfish · cấp ${localGame.botLevel}`
              : "Người chơi 2"
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl text-slate-100">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              A2OJ · Giải trí
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Chess Arena
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Chọn nhịp độ, ghép trận nhanh hoặc tham gia một phòng đang mở.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/5 px-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-300/10"
            href="/chess/leaderboard"
          >
            <Trophy aria-hidden="true" className="size-4" />
            Bảng Elo toàn trường
          </Link>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-white/8 bg-slate-900/80 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Thời gian mỗi bên</h2>
            <p className="mt-1 text-xs text-slate-500">
              Số sau dấu + là thời gian cộng thêm mỗi nước.
            </p>
          </div>
          <label className="w-full max-w-xs text-xs text-slate-400">
            Tên hiển thị
            <input
              className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
              maxLength={24}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Tên của bạn"
              value={playerName}
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(["siêu chớp", "chớp", "cờ chớp"] as const).map((group) => (
            <div className="rounded-xl border border-white/6 bg-slate-950/40 p-3" key={group}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                {group}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {CHESS_TIME_CONTROLS.filter((control) => control.group === group).map((control) => (
                  <button
                    aria-label={`${control.label} ${control.name}`}
                    aria-pressed={selectedTimeControlId === control.id}
                    className={`min-h-16 rounded-lg border px-2 py-2 text-center transition ${
                      selectedTimeControlId === control.id
                        ? "border-emerald-300/50 bg-emerald-300/10 text-white"
                        : "border-white/8 bg-slate-950/60 text-slate-300 hover:border-white/20"
                    }`}
                    key={control.id}
                    onClick={() => setSelectedTimeControlId(control.id)}
                    type="button"
                  >
                    <span className="block font-mono text-sm font-black sm:text-base">
                      {control.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-3 rounded-xl border p-3 transition ${
            selectedTimeControlId.startsWith("custom-")
              ? "border-emerald-300/50 bg-emerald-300/10"
              : "border-white/8 bg-slate-950/40"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">Tùy chỉnh thời gian</p>
              <p className="mt-1 text-xs text-slate-400">
                Áp dụng cho ván cục bộ, đấu bot và phòng online.
              </p>
            </div>
            <button
              aria-pressed={selectedTimeControlId.startsWith("custom-")}
              className="min-h-9 rounded-lg border border-emerald-300/30 px-3 text-xs font-bold text-emerald-100 hover:bg-emerald-300/10"
              disabled={!customTimeControlId}
              onClick={() => {
                if (customTimeControlId) setSelectedTimeControlId(customTimeControlId);
              }}
              type="button"
            >
              Chọn {customMinutes} phút
              {customIncrement !== "0" ? ` + ${customIncrement} giây` : ""}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-400">
              Thời gian ban đầu (phút)
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400/50"
                max={180}
                min={1}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomMinutes(value);
                  const nextId = `custom-${Number(value)}-${Number(customIncrement)}`;
                  if (getChessTimeControl(nextId)) setSelectedTimeControlId(nextId);
                }}
                type="number"
                value={customMinutes}
              />
            </label>
            <label className="text-xs font-medium text-slate-400">
              Cộng thêm mỗi nước (giây)
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400/50"
                max={60}
                min={0}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomIncrement(value);
                  const nextId = `custom-${Number(customMinutes)}-${Number(value)}`;
                  if (getChessTimeControl(nextId)) setSelectedTimeControlId(nextId);
                }}
                type="number"
                value={customIncrement}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Giới hạn 1–180 phút và 0–60 giây cộng thêm.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/50 p-3">
          <div>
            <p className="text-sm font-bold text-white">Trận có xếp hạng Elo</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Chỉ tính Elo khi ván rated kết thúc. Ván cục bộ luôn không xếp hạng.
            </p>
          </div>
          {canPlayRated ? (
            <button
              aria-pressed={isRated}
              className={`min-h-10 rounded-lg border px-4 text-sm font-bold transition ${
                isRated
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
              onClick={() => setIsRated((value) => !value)}
              type="button"
            >
              {isRated ? "Đang bật · Rated" : "Chỉ chơi giao hữu"}
            </button>
          ) : accountUserId ? (
            <p className="text-xs font-semibold text-slate-400">
              Chỉ tài khoản học sinh có thể tính Elo.
            </p>
          ) : (
            <Link
              className="inline-flex min-h-10 items-center rounded-lg border border-white/10 bg-slate-900 px-4 text-sm font-bold text-slate-300 hover:bg-slate-800"
              href="/login"
            >
              Đăng nhập để tính Elo
            </Link>
          )}
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-emerald-200">
            <Swords aria-hidden="true" className="size-5" />
            <h2 className="font-bold text-white">Ghép ngẫu nhiên</h2>
          </div>
          <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">
            Tìm phòng có cùng thời gian. Nếu chưa có ai, bạn sẽ được đưa vào hàng chờ.
          </p>
          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={realtimeStatus !== "connected" || busy || !isSelectedTimeControlValid}
            onClick={findRandomMatch}
            type="button"
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Swords aria-hidden="true" className="size-4" />
            )}
            Tìm đối thủ · {selectedTimeControl.label}
          </button>
        </article>

        <article className="rounded-2xl border border-white/8 bg-slate-900/80 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <DoorOpen aria-hidden="true" className="size-5 text-sky-300" />
            <h2 className="font-bold text-white">Tạo phòng công khai</h2>
          </div>
          <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">
            Mở phòng cho danh sách bên dưới hoặc gửi liên kết trực tiếp cho bạn bè.
          </p>
          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/10 px-4 text-sm font-bold text-sky-100 transition hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={realtimeStatus !== "connected" || busy || !isSelectedTimeControlValid}
            onClick={() => void createRoom(false)}
            type="button"
          >
            <DoorOpen aria-hidden="true" className="size-4" />
            Mở phòng · {selectedTimeControl.label}
          </button>
        </article>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Radio
            aria-hidden="true"
            className={`size-4 ${realtimeStatus === "connected" ? "text-emerald-300" : "text-amber-300"}`}
          />
          {realtimeStatus === "connected"
            ? "Đã kết nối sảnh online"
            : realtimeStatus === "connecting"
              ? hasRealtimeConfig
                ? "Đang kết nối sảnh online..."
                : "Đang kiểm tra cấu hình sảnh online..."
              : "Sảnh online chưa được cấu hình"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5"
            disabled={!isSelectedTimeControlValid}
            onClick={() =>
              setLocalGame({
                ...selectedTimeControl,
                mode: "local",
                botLevel,
              })
            }
            type="button"
          >
            <Users aria-hidden="true" className="size-4" />
            Chơi cục bộ
          </button>
          <label className="sr-only" htmlFor="chess-bot-level">
            Độ khó Stockfish
          </label>
          <select
            className="min-h-9 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs font-semibold text-slate-300"
            id="chess-bot-level"
            onChange={(event) => setBotLevel(Number(event.target.value))}
            value={botLevel}
          >
            <option value={2}>Bot dễ</option>
            <option value={6}>Bot vừa</option>
            <option value={12}>Bot khó</option>
            <option value={20}>Bot mạnh nhất</option>
          </select>
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/5 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-300/10"
            disabled={!isSelectedTimeControlValid}
            onMouseEnter={preloadStockfishForBot}
            onFocus={preloadStockfishForBot}
            onClick={() => {
              preloadStockfishForBot();
              setLocalGame({
                ...selectedTimeControl,
                mode: "bot",
                botLevel,
              });
            }}
            type="button"
          >
            <Bot aria-hidden="true" className="size-4" />
            Đấu Stockfish
          </button>
        </div>
      </div>

      {notice && (
        <p
          className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          {notice}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold text-white">Các phòng đang mở</h2>
            <p className="mt-1 text-xs text-slate-500">
              Phòng tự biến mất khi chủ phòng rời sảnh.
            </p>
          </div>
          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {openRooms.filter((room) => room.playerId !== playerId).length} phòng
          </span>
        </div>

        {realtimeStatus !== "connected" ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-300">
              {realtimeStatus === "connecting"
                ? "Đang tải danh sách phòng..."
                : "Cần cấu hình Supabase Realtime để tạo và xem phòng online."}
            </p>
            {realtimeStatus === "offline" && (
              <p className="mt-2 text-xs text-slate-500">
                Khai báo NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY (hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
              </p>
            )}
          </div>
        ) : openRooms.filter((room) => room.playerId !== playerId).length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-300">Chưa có phòng phù hợp</p>
            <p className="mt-1 text-xs text-slate-500">
              Mở phòng hoặc bấm ghép ngẫu nhiên để chờ đối thủ.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {openRooms
              .filter((room) => room.playerId !== playerId)
              .map((room) => {
                const timeControl = getChessTimeControl(room.timeControlId);
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    key={room.roomId}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {room.playerName}
                        {room.isRandom && (
                          <span className="ml-2 rounded-md bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            Ghép nhanh
                          </span>
                        )}
                        {room.isRated && (
                          <span className="ml-2 rounded-md bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                            Rated
                          </span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {timeControl?.label ?? "5 + 0"} · {timeControl?.name ?? "Blitz"} · Phòng{" "}
                        {room.roomId}
                      </p>
                    </div>
                    <button
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/30 px-3 text-xs font-bold text-emerald-200 transition hover:bg-emerald-300/10"
                      onClick={() => joinRoom(room)}
                      type="button"
                    >
                      <DoorOpen aria-hidden="true" className="size-4" />
                      Tham gia
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </main>
  );
}
