"use client";

import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { TransactionView } from "./types";

export function HistoryTab({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--navy)]">Lịch Sử Biến Động Số Dư &amp; Giao Dịch</h2>
        <p className="text-xs text-[var(--muted)]">Theo dõi biến động A2 Coin, quy đổi và mua bán</p>
      </div>

      {transactions.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <span className="text-4xl opacity-30">📜</span>
          <p className="mt-2 text-sm text-[var(--muted)]">Chưa có lịch sử giao dịch nào được ghi nhận.</p>
        </Card>
      ) : (
        <Card variant="default" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-strong)] text-xs text-[var(--cream)] uppercase">
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                  <th className="px-4 py-3 font-semibold">Hoạt động</th>
                  <th className="px-4 py-3 font-semibold">Chi tiết</th>
                  <th className="px-5 py-3 text-right font-semibold">Biến động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]/50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--teal)]/5 transition-colors">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--muted)] font-mono">
                      {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant="teal" size="sm">
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--navy)]">
                      {tx.description}
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 text-right font-mono text-sm font-bold ${
                      tx.amount > 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {tx.amount > 0 ? `+${tx.amount.toLocaleString("vi-VN")}` : tx.amount.toLocaleString("vi-VN")} {tx.currency === "A2_COIN" ? "A2C" : "pts"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
