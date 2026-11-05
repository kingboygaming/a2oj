import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { ChessLobby } from "@/components/ChessLobby";

export const metadata: Metadata = {
  title: "Chess Arena | A2OJ",
  description: "Chơi cờ vua nhanh cùng bạn bè tại A2OJ Chess Arena.",
};

export default async function ChessPage() {
  const user = await getCurrentUser();
  return (
    <ChessLobby
      accountUserId={user?.id ?? null}
      canPlayRated={user?.role === "STUDENT"}
      initialPlayerName={user?.displayName ?? "Người chơi"}
    />
  );
}
