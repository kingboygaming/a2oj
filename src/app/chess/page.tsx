import type { Metadata } from "next";
import { ChessArena } from "@/components/ChessArena";

export const metadata: Metadata = {
  title: "Chess Arena | A2OJ",
  description: "Chơi cờ vua nhanh cùng bạn bè tại A2OJ Chess Arena.",
};

export default function ChessPage() {
  return <ChessArena />;
}
