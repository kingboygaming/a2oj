import type { Metadata } from "next";
import { ChessLobby } from "@/components/ChessLobby";

export const metadata: Metadata = {
  title: "Chess Arena | A2OJ",
  description: "Chơi cờ vua nhanh cùng bạn bè tại A2OJ Chess Arena.",
};

export default function ChessPage() {
  return <ChessLobby />;
}
